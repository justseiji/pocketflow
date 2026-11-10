import { beforeAll, afterAll, describe, it, expect } from "vitest";
import supertest from "supertest";
import { openDatabase, type Database } from "../server/db";
import { createApp } from "../server/app";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("authenticated persistence API", () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;
  let folder: string;
  let alice: ReturnType<typeof supertest.agent>;
  let bob: ReturnType<typeof supertest.agent>;
  let csrf = "";
  let bobCsrf = "";
  const origin = "http://localhost:5173";
  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "pocketflow-api-"));
    db = await openDatabase({ directory: folder });
    app = createApp(db);
    alice = supertest.agent(app);
    bob = supertest.agent(app);
  });
  afterAll(async () => {
    await db.close();
    await rm(folder, { recursive: true, force: true });
  });
  it("requires authentication and validates registration", async () => {
    expect((await supertest(app).get("/api/portfolio")).status).toBe(401);
    expect(
      (
        await alice
          .post("/api/auth/register")
          .set("Origin", origin)
          .send({ name: "Alice", email: "bad", password: "short" })
      ).status,
    ).toBe(400);
    const result = await alice
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "Alice",
        email: "alice@example.test",
        password: "A private test passphrase",
      });
    expect(result.status).toBe(200);
    csrf = result.body.csrf;
    expect(result.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(result.headers["set-cookie"][0]).toContain("SameSite=Lax");
    const other = await bob
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "Bob",
        email: "bob@example.test",
        password: "Another test passphrase",
      });
    bobCsrf = other.body.csrf;
  });
  it("blocks cross-origin requests, missing CSRF and duplicate emails", async () => {
    expect(
      (
        await alice
          .post("/api/commands")
          .set("Origin", "https://attacker.example")
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (await alice.post("/api/commands").set("Origin", origin).send({})).status,
    ).toBe(403);
    expect(
      (
        await alice.post("/api/auth/register").set("Origin", origin).send({
          name: "Again",
          email: "ALICE@example.test",
          password: "A private test passphrase",
        })
      ).status,
    ).toBe(409);
  });
  it("saves valid commands, isolates users and rejects stale versions", async () => {
    const body = {
      version: 0,
      command: {
        type: "saveAccount",
        value: { id: "wallet", name: "Cash", opening: 500000 },
      },
    };
    const result = await alice
      .post("/api/commands")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send(body);
    expect(result.status).toBe(200);
    expect(result.body.version).toBe(1);
    expect((await bob.get("/api/portfolio")).body.state.accounts).toEqual([]);
    expect(
      (
        await alice
          .post("/api/commands")
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send(body)
      ).status,
    ).toBe(409);
    const forged = await bob
      .post("/api/commands")
      .set("Origin", origin)
      .set("X-CSRF-Token", bobCsrf)
      .send({
        version: 0,
        userId: result.body.userId,
        command: {
          type: "saveTransaction",
          value: {
            id: "x",
            type: "expense",
            amount: 1,
            accountId: "wallet",
            date: "2026-01-01",
            note: "",
          },
        },
      });
    expect(forged.status).toBe(422);
  });
  it("permits only one concurrent edit and preserves the other changes", async () => {
    const results = await Promise.all(
      ["one", "two"].map((name) =>
        alice
          .post("/api/commands")
          .set("Origin", origin)
          .set("X-CSRF-Token", csrf)
          .send({
            version: 1,
            command: {
              type: "saveAllocation",
              value: {
                id: name,
                name,
                limit: 200000,
                kind: "category",
                essential: false,
                locked: false,
              },
            },
          }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const current = await alice.get("/api/portfolio");
    expect(current.body.version).toBe(2);
    expect(current.body.state.allocations).toHaveLength(1);
  });
  it("retains data and sessions through database restart, and logs out", async () => {
    await db.close();
    db = await openDatabase({ directory: folder });
    // Existing app methods delegate through this object, so inspect persistence directly then use a new app for login.
    expect(
      (await db.query("SELECT version FROM portfolios WHERE version=2")).rows,
    ).toHaveLength(1);
    const auth = await db.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email=$1",
      ["alice@example.test"],
    );
    expect(auth.rows[0].password_hash).not.toContain("passphrase");
    const agent = supertest.agent(createApp(db));
    const login = await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({
        email: "alice@example.test",
        password: "A private test passphrase",
      });
    expect(login.status).toBe(200);
    expect((await agent.get("/api/portfolio")).body.version).toBe(2);
    await agent
      .post("/api/auth/logout")
      .set("Origin", origin)
      .set("X-CSRF-Token", login.body.csrf)
      .send({})
      .expect(200);
    await agent.get("/api/portfolio").expect(401);
    await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "alice@example.test", password: "Wrong password here" })
      .expect(401);
  });
});
