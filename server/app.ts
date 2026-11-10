import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { resolve } from "node:path";
import { z, ZodError } from "zod";
import type { Database } from "./db";
import {
  commandSchema,
  disruptionSchema,
  initialState,
  type State,
} from "../shared/model";
import { execute } from "../shared/commands";
import { recovery } from "../shared/recovery";

let activeHashes = 0;
async function scrypt(
  password: string,
  salt: string,
  _length: number,
): Promise<Buffer> {
  if (activeHashes >= 4)
    throw new HttpError(429, "Sign-in is busy. Please try again shortly.");
  activeHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scryptCallback(
        password,
        salt,
        64,
        { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
        (error, result) => (error ? reject(error) : resolve(result)),
      ),
    );
  } finally {
    activeHashes--;
  }
}
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});
const registration = credentials.extend({
  name: z.string().trim().min(1).max(80),
});
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
interface Identity {
  id: string;
  name: string;
  email: string;
  csrf: string;
}
type AuthRequest = Request & { identity?: Identity };

export function createApp(
  db: Database,
  options: {
    production?: boolean;
    origin?: string;
    serveStatic?: boolean;
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  if (
    options.production &&
    (!options.origin || !options.origin.startsWith("https://"))
  )
    throw new Error("Production requires an HTTPS APP_ORIGIN.");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "style-src": ["'self'", "'unsafe-inline'"],
          "upgrade-insecure-requests": options.production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const origins = new Set(
    options.origin
      ? [new URL(options.origin).origin]
      : [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ],
  );
  app.use("/api", (req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (!origins.has(req.get("origin") ?? ""))
        throw new HttpError(403, "Request origin is not allowed.");
      if (!req.is("application/json"))
        throw new HttpError(415, "Send JSON data.");
    }
    next();
  });
  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again in 15 minutes." },
  });
  app.use("/api/auth/register", authLimit);
  app.use("/api/auth/login", authLimit);
  async function session(
    res: Response,
    user: { id: string; name: string; email: string },
  ) {
    const token = randomBytes(32).toString("hex");
    const csrf = randomBytes(32).toString("hex");
    await db.query("DELETE FROM sessions WHERE expires_at < now()");
    await db.query(
      "INSERT INTO sessions(token_hash, user_id, csrf, expires_at) VALUES($1,$2,$3,$4)",
      [digest(token), user.id, csrf, new Date(Date.now() + 7 * 86400000)],
    );
    res.cookie("pf_session", token, {
      httpOnly: true,
      secure: !!options.production,
      sameSite: "lax",
      maxAge: 7 * 86400000,
      path: "/",
    });
    res.json({ user, csrf });
  }
  app.post("/api/auth/register", async (req, res) => {
    const input = registration.parse(req.body);
    const salt = randomBytes(16).toString("hex");
    const hash = (await scrypt(input.password, salt, 64)) as Buffer;
    const user = { id: randomUUID(), name: input.name, email: input.email };
    try {
      await db.query(
        "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4)",
        [user.id, user.email, user.name, `${salt}:${hash.toString("hex")}`],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new HttpError(
          409,
          "An account with this email already exists. Sign in instead.",
        );
      throw error;
    }
    await session(res, user);
  });
  app.post("/api/auth/login", async (req, res) => {
    const input = credentials.parse(req.body);
    const { rows } = await db.query<{
      id: string;
      email: string;
      name: string;
      password_hash: string;
    }>("SELECT id,email,name,password_hash FROM users WHERE email=$1", [
      input.email,
    ]);
    const user = rows[0];
    const [salt, stored] = user?.password_hash.split(":") ?? [
      "pocketflow-dummy-salt",
      "00".repeat(64),
    ];
    const actual = (await scrypt(input.password, salt, 64)) as Buffer;
    if (!timingSafeEqual(actual, Buffer.from(stored, "hex")) || !user)
      throw new HttpError(401, "Email or password is incorrect.");
    await session(res, { id: user.id, email: user.email, name: user.name });
  });
  app.use("/api", async (req: AuthRequest, _res, next) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("pf_session="))
      ?.slice("pf_session=".length);
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new HttpError(401, "Sign in to continue.");
    const { rows } = await db.query<Identity & Record<string, unknown>>(
      "SELECT u.id,u.name,u.email,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [digest(token)],
    );
    if (!rows[0])
      throw new HttpError(401, "Your session has expired. Sign in again.");
    req.identity = rows[0];
    if (req.method !== "GET" && req.get("x-csrf-token") !== req.identity.csrf)
      throw new HttpError(403, "Refresh the page before making changes.");
    next();
  });
  app.get("/api/auth/me", (req: AuthRequest, res) => {
    const { csrf, ...user } = req.identity!;
    res.json({ user, csrf });
  });
  app.post("/api/auth/logout", async (req: AuthRequest, res) => {
    await db.query("DELETE FROM sessions WHERE user_id=$1 AND csrf=$2", [
      req.identity!.id,
      req.identity!.csrf,
    ]);
    res.clearCookie("pf_session", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: !!options.production,
    });
    res.json({ ok: true });
  });
  async function portfolio(userId: string) {
    await db.query(
      "INSERT INTO portfolios(user_id,data) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING",
      [userId, JSON.stringify(initialState())],
    );
    const { rows } = await db.query<{ data: State; version: number }>(
      "SELECT data,version FROM portfolios WHERE user_id=$1",
      [userId],
    );
    return { state: rows[0].data, version: rows[0].version };
  }
  app.get("/api/portfolio", async (req: AuthRequest, res) => {
    res.json(await portfolio(req.identity!.id));
  });
  app.post("/api/recovery/preview", async (req: AuthRequest, res) => {
    const disruption = disruptionSchema.parse(req.body);
    const current = await portfolio(req.identity!.id);
    res.json({
      version: current.version,
      ...recovery(current.state, disruption),
    });
  });
  app.post("/api/commands", async (req: AuthRequest, res) => {
    const input = z
      .object({ version: z.number().int().min(0), command: commandSchema })
      .parse(req.body);
    const current = await portfolio(req.identity!.id);
    if (input.version !== current.version)
      throw new HttpError(
        409,
        "Your plan changed in another tab. Refresh and review the latest figures.",
      );
    let updated: State;
    try {
      updated = execute(
        current.state,
        input.command,
        current.version,
        randomUUID,
      );
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw new HttpError(422, (error as Error).message);
    }
    const { rows } = await db.query(
      "UPDATE portfolios SET data=$1, version=version+1, updated_at=now() WHERE user_id=$2 AND version=$3 RETURNING version",
      [JSON.stringify(updated), req.identity!.id, current.version],
    );
    if (!rows.length)
      throw new HttpError(
        409,
        "Another change arrived first. Refresh your plan and try again.",
      );
    res.json({ state: updated, version: rows[0].version });
  });
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "Endpoint not found.")),
  );
  if (options.serveStatic) {
    app.use(express.static(resolve("dist/client")));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("dist/client/index.html")),
    );
  }
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof ZodError) {
        res
          .status(400)
          .json({ error: error.issues[0]?.message ?? "Invalid input." });
        return;
      }
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      const status = (error as { status?: number }).status;
      if (status === 400 || status === 413) {
        res.status(status).json({
          error: status === 413 ? "Request is too large." : "Invalid JSON.",
        });
        return;
      }
      console.error("Request failed", {
        type: error instanceof Error ? error.name : "Unknown",
      });
      res.status(500).json({
        error:
          "Something went wrong. Your change was not saved. Please try again.",
      });
    },
  );
  return app;
}
