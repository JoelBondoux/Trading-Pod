#!/usr/bin/env node
// ============================================================================
// D1 Migration Script — Apply schema to Cloudflare D1 database
// ============================================================================
// Usage:
//   node scripts/migrate-d1.mjs                     # Apply to production
//   node scripts/migrate-d1.mjs --env staging       # Apply to staging
//   node scripts/migrate-d1.mjs --local             # Apply to local dev DB
//   node scripts/migrate-d1.mjs --dry-run           # Preview commands only
// ============================================================================

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const local = args.includes("--local");
const envIdx = args.indexOf("--env");
const env = envIdx !== -1 ? args[envIdx + 1] : undefined;

const DB_NAME = "trading-pod-db";
const SCHEMA_PATH = resolve(ROOT, "packages/backend/d1-schema.sql");

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

if (!existsSync(SCHEMA_PATH)) {
  console.error(`❌  Schema file not found: ${SCHEMA_PATH}`);
  process.exit(1);
}

// Check wrangler is available
try {
  execSync("npx wrangler --version", { stdio: "pipe" });
} catch {
  console.error("❌  wrangler CLI not found. Run: pnpm add -Dw wrangler");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build wrangler command
// ---------------------------------------------------------------------------

const schema = readFileSync(SCHEMA_PATH, "utf-8");

// Strip SQL comment lines, then split into individual statements
// (D1 execute runs one statement at a time)
const statements = schema
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`\n📦  Trading-Pod D1 Migration`);
console.log(`   Database:   ${DB_NAME}`);
console.log(`   Schema:     ${SCHEMA_PATH}`);
console.log(`   Statements: ${statements.length}`);
console.log(`   Mode:       ${dryRun ? "DRY RUN" : local ? "LOCAL" : env ? `env:${env}` : "PRODUCTION"}\n`);

if (dryRun) {
  console.log("─── SQL statements that would be executed ───\n");
  for (const stmt of statements) {
    console.log(`  ${stmt};\n`);
  }
  console.log("─── End dry run ───\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

let success = 0;
let failed = 0;

for (const stmt of statements) {
  const envFlag = env ? `--env ${env}` : "";
  const localFlag = local ? "--local" : "";
  const cmd = `npx wrangler d1 execute ${DB_NAME} ${envFlag} ${localFlag} --command="${stmt.replace(/"/g, '\\"')}"`;

  try {
    console.log(`  ✓  ${stmt.slice(0, 60)}...`);
    execSync(cmd, { stdio: "pipe", cwd: resolve(ROOT, "packages/backend/fc-worker") });
    success++;
  } catch (err) {
    // CREATE IF NOT EXISTS may still succeed — check if it's a real error
    const stderr = err.stderr?.toString() ?? "";
    if (stderr.includes("already exists")) {
      console.log(`     ⚠  Already exists (skipped)`);
      success++;
    } else {
      console.error(`  ✗  FAILED: ${stderr.slice(0, 200)}`);
      failed++;
    }
  }
}

console.log(`\n✅  Migration complete: ${success} succeeded, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
