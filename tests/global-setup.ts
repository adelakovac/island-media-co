import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const dbPath = path.resolve(__dirname, "../prisma/test.db");

/** Runs once before the whole suite: builds a fresh test.db schema (no data - tests seed their own). */
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
  }

  execSync("npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });

  // No teardown deletion here: on Windows the sqlite file can still be locked
  // by a just-closing worker connection when global teardown runs, which
  // turns a harmless leftover file into a spurious EBUSY error. The file is
  // gitignored and gets wiped at the start of the next run instead.
}
