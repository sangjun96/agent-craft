// Applies the Drizzle migrations in ./drizzle to the D1 database declared in cloudflare.config.ts.
// `cf d1 migrations apply` takes the database ID, not its name, so the ID is read from the config.
import { spawnSync } from "node:child_process";
import config from "../cloudflare.config.ts";

const target = process.argv[2];
if (target !== "local" && target !== "remote") {
  console.error("Usage: node scripts/d1-migrate.ts <local|remote>");
  process.exit(1);
}

const args = [
  "d1",
  "migrations",
  "apply",
  config.worker.env.DB.id,
  // Drizzle writes one folder per migration: drizzle/<timestamp>_<name>/migration.sql.
  "--dir",
  "drizzle",
  "--pattern",
  "drizzle/*/migration.sql",
  // The dev server (Cloudflare Vite plugin 2.0 beta) reads its D1 data from .cloudflare/state.
  ...(target === "local" ? ["--local", "--persist-to", ".cloudflare/state"] : []),
];
process.exit(spawnSync("cf", args, { stdio: "inherit" }).status ?? 1);
