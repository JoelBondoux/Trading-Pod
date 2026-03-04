#!/usr/bin/env node
// ============================================================================
// Trading-Pod Self-Upgrade — Pull latest from GitHub and rebuild
// ============================================================================
// Usage:
//   node scripts/upgrade.mjs                    # upgrade from main
//   node scripts/upgrade.mjs --branch develop   # upgrade from specific branch
//   node scripts/upgrade.mjs --dry-run          # preview without applying
//   node scripts/upgrade.mjs --force            # skip dirty-tree check
//
// What it does:
//   1. Checks for uncommitted changes (aborts unless --force)
//   2. Fetches latest from origin
//   3. Shows a diff summary of incoming changes
//   4. Pulls and fast-forwards
//   5. Installs any new/changed dependencies
//   6. Rebuilds shared + agents (declaration files)
//   7. Runs typecheck across all packages
//   8. Reports success or failure with rollback instructions
//
// This script NEVER touches your .env, .dev.vars, or wrangler secrets.
// Configuration stored in KV/D1 is unaffected.
// ============================================================================

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const branchIdx = args.indexOf("--branch");
const branch = branchIdx !== -1 ? args[branchIdx + 1] : "main";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a shell command in the repo root, returning stdout. */
function run(cmd, opts = {}) {
  const { silent = false, allowFail = false } = opts;
  if (!silent) console.log(`  > ${cmd}`);
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: silent ? "pipe" : "inherit",
    });
  } catch (err) {
    if (allowFail) return "";
    console.error(`\n✘ Command failed: ${cmd}`);
    process.exit(1);
  }
}

/** Run a command silently and return trimmed stdout. */
function runSilent(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function header(msg) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${msg}`);
  console.log(`${"═".repeat(60)}\n`);
}

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

header("Trading-Pod Upgrade");

// Ensure we're in a git repo
if (!existsSync(resolve(ROOT, ".git"))) {
  console.error("✘ Not a git repository. Run this from the trading-pod root.");
  process.exit(1);
}

// Ensure pnpm is available
try {
  runSilent("pnpm --version");
} catch {
  console.error("✘ pnpm is not installed. Run: npm install -g pnpm@9");
  process.exit(1);
}

// Check current branch
const currentBranch = runSilent("git rev-parse --abbrev-ref HEAD");
console.log(`Current branch: ${currentBranch}`);
console.log(`Target branch:  ${branch}`);

// Check for uncommitted changes
const status = runSilent("git status --porcelain");
if (status && !force) {
  console.error("\n✘ You have uncommitted changes:\n");
  console.error(status);
  console.error("\nCommit or stash them first, or use --force to skip this check.");
  process.exit(1);
}

// Record current commit for rollback
const previousCommit = runSilent("git rev-parse HEAD");
console.log(`Current commit: ${previousCommit.slice(0, 8)}`);

// ---------------------------------------------------------------------------
// Step 1: Fetch latest
// ---------------------------------------------------------------------------

header("Step 1/5 — Fetching latest from origin");
run("git fetch origin");

// Show what's incoming
const behind = runSilent(`git rev-list HEAD..origin/${branch} --count`);
const ahead = runSilent(`git rev-list origin/${branch}..HEAD --count`);

console.log(`\nLocal is ${behind} commit(s) behind, ${ahead} commit(s) ahead of origin/${branch}`);

if (behind === "0") {
  console.log("\n✓ Already up to date. Nothing to upgrade.");
  process.exit(0);
}

// Show summary of incoming changes
console.log("\nIncoming changes:");
run(`git log --oneline HEAD..origin/${branch}`, { silent: false });

console.log("\nFiles changed:");
const diffStat = runSilent(`git diff --stat HEAD..origin/${branch}`);
console.log(diffStat);

// ---------------------------------------------------------------------------
// Step 2: Dry-run exit point
// ---------------------------------------------------------------------------

if (dryRun) {
  header("Dry Run Complete");
  console.log("No changes applied. Remove --dry-run to apply the upgrade.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 3: Pull
// ---------------------------------------------------------------------------

header("Step 2/5 — Pulling changes");

if (parseInt(ahead) > 0) {
  console.log("⚠ Local commits exist ahead of origin. Using merge strategy.");
  run(`git merge origin/${branch} --no-edit`);
} else {
  run(`git pull origin ${branch} --ff-only`);
}

const newCommit = runSilent("git rev-parse HEAD");
console.log(`\nUpdated to: ${newCommit.slice(0, 8)}`);

// ---------------------------------------------------------------------------
// Step 4: Install dependencies
// ---------------------------------------------------------------------------

header("Step 3/5 — Installing dependencies");
run("pnpm install --frozen-lockfile");

// ---------------------------------------------------------------------------
// Step 5: Rebuild
// ---------------------------------------------------------------------------

header("Step 4/5 — Rebuilding");
run("pnpm --filter @trading-pod/shared run build");
run("pnpm --filter @trading-pod/agents run build");

// ---------------------------------------------------------------------------
// Step 6: Typecheck
// ---------------------------------------------------------------------------

header("Step 5/5 — Type checking");
try {
  execSync("pnpm -r typecheck", { cwd: ROOT, encoding: "utf-8", stdio: "inherit" });
} catch {
  console.error("\n✘ Typecheck failed after upgrade.");
  console.error(`\nTo rollback: git reset --hard ${previousCommit}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

header("Upgrade Complete ✓");
console.log(`  Previous: ${previousCommit.slice(0, 8)}`);
console.log(`  Current:  ${newCommit.slice(0, 8)}`);
console.log(`  Branch:   ${branch}`);
console.log(`\n  If anything is wrong, rollback with:`);
console.log(`    git reset --hard ${previousCommit}\n`);
console.log(`  After upgrade, redeploy workers with:`);
console.log(`    pnpm --filter './packages/backend/*' run deploy\n`);
