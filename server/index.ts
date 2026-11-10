import { openDatabase } from "./db";
import { createApp } from "./app";

const production = process.env.NODE_ENV === "production";
if (production && !process.env.DATABASE_URL)
  throw new Error("Production requires DATABASE_URL.");
const db = await openDatabase({
  url: process.env.DATABASE_URL,
  directory: process.env.DATA_DIR ?? ".data/pocketflow",
});
const app = createApp(db, {
  production,
  origin: process.env.APP_ORIGIN,
  serveStatic: true,
});
const server = app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () =>
  console.log(`PocketFlow API listening on port ${process.env.PORT ?? 3001}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close(() => {
      void db.close().then(() => process.exit(0));
    });
  });
