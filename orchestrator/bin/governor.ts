#!/usr/bin/env node
import { findWorkspaceRoot } from "../src/paths.ts";
import { loadConfig } from "../src/config.ts";
import { runScan } from "../src/commands/scan.ts";
import { runState } from "../src/commands/state.ts";
import { runNext } from "../src/commands/next.ts";
import { runConflicts } from "../src/commands/conflicts.ts";
import { runDoctor } from "../src/commands/doctor.ts";
import { runVerify } from "../src/commands/verify.ts";
import { runAuditCommand, summarize as summarizeAudit } from "../src/commands/audit.ts";
import { runPreflight } from "../src/commands/preflight.ts";
import { runIntegrate } from "../src/commands/integrate.ts";
import { runUndo } from "../src/commands/undo.ts";
import { runMetrics } from "../src/commands/metrics.ts";
import { runChurn } from "../src/commands/churn.ts";
import { runOwnership } from "../src/commands/ownership.ts";
import { relative } from "node:path";

const USAGE = `governor — workspace orchestrator

USAGE
  governor <command> [args]

COMMANDS
  scan                Walk worktrees + manifests, write .cache.json (TRANSIENT)
  state               Build STATE.proposed.md from per-package state
  next                Compute DAG of pending manifests → governance/dag.md
  conflicts           Intersect file scopes of active manifests → governance/conflicts.md
  audit [--only IDS]  Run 13 rules → governance/audit-<date>.md + regen overrides.md
  preflight <path>    Validate manifest schema + deps + scope → governance/preflight-<id>.md
  integrate <repo> <branch> [--dry-run]
                      Transactional merge: worktree branch → main; archive manifests; log txn
  undo [<txn-id>]     Replay inverse of latest (or named) transaction
  metrics             Aggregate audit + integration + manifest signals → governance/metrics.md
  churn <repo>        Top-N modified files per repo → governance/churn-<repo>.md
  ownership <path>    Resolve editor + authority + manifest claims for a path
  doctor              Verify HOT path + config + schemas + repo presence
  verify <path>       Re-hash sources listed in a DERIVED file footer
  help                Show this message

EXIT CODES
  0 success
  1 command failure (write, lock, parse, IO)
  2 doctor / verify check failed
  3 usage error

The orchestrator is read-only on CANONICAL files. It writes only DERIVED,
OPERATIONAL, and TRANSIENT artifacts. See .governor/v3/01-file-taxonomy.md.
`;

async function main(argv: string[]): Promise<number> {
  const [, , cmd, ...args] = argv;
  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    process.stdout.write(USAGE);
    return 0;
  }
  const root = findWorkspaceRoot();
  const loaded = loadConfig(root);
  const rel = (p: string) => relative(root, p).replace(/\\/g, "/");

  switch (cmd) {
    case "scan": {
      const cache = await runScan(loaded);
      const wts = Object.values(cache.repos).reduce(
        (n, r) => n + r.worktrees.length,
        0,
      );
      const ms = Object.values(cache.repos).reduce(
        (n, r) => n + r.manifests_active.length,
        0,
      );
      console.log(
        `scan: ${loaded.config.repos.length} repos, ${wts} worktrees, ${ms} active manifests → ${loaded.config.orchestrator.cache_file}`,
      );
      return 0;
    }
    case "state": {
      const out = await runState(loaded);
      console.log(`state: ${rel(out)}`);
      return 0;
    }
    case "next": {
      const out = await runNext(loaded);
      console.log(`next: ${rel(out)}`);
      return 0;
    }
    case "conflicts": {
      const out = await runConflicts(loaded);
      console.log(`conflicts: ${rel(out)}`);
      return 0;
    }
    case "preflight": {
      const target = args[0];
      if (!target) {
        process.stderr.write("preflight: missing <manifest> argument\n");
        return 3;
      }
      const result = runPreflight(loaded, target);
      const errs = result.findings.filter((f) => f.severity === "ERROR");
      const warns = result.findings.filter((f) => f.severity === "WARNING");
      for (const f of result.findings) {
        const tag = f.severity === "ERROR" ? "ERR " : "WARN";
        console.log(`  [${tag}] [${f.category}] ${f.message}`);
      }
      const reportRel = result.reportPath ? rel(result.reportPath) : "(no report)";
      console.log(
        `preflight: ${result.ok ? "READY" : "BLOCKED"} — ${errs.length} error(s), ${warns.length} warning(s) → ${reportRel}`,
      );
      return result.ok ? 0 : 2;
    }
    case "integrate": {
      const repoName = args[0];
      const branch = args[1];
      if (!repoName || !branch) {
        process.stderr.write("integrate: usage: governor integrate <repo> <branch> [--dry-run]\n");
        return 3;
      }
      const dryRun = args.includes("--dry-run");
      const result = await runIntegrate(loaded, repoName, branch, { dryRun });
      for (const s of result.steps) {
        const tag = s.applied ? "DONE" : "PLAN";
        console.log(`  [${tag}] ${s.description}`);
      }
      if (result.error) {
        process.stderr.write(`integrate: ${result.error}\n`);
        return 2;
      }
      console.log(
        `integrate: ${result.ok ? (dryRun ? "DRY-RUN OK" : "OK") : "FAIL"} — txn ${result.txnId ?? "(none)"}`,
      );
      return result.ok ? 0 : 2;
    }
    case "undo": {
      const targetId = args[0];
      const result = await runUndo(loaded, targetId);
      for (const s of result.steps) {
        const tag = s.applied ? "DONE" : "FAIL";
        console.log(`  [${tag}] ${s.description}${s.error ? ` — ${s.error}` : ""}`);
      }
      if (result.error) {
        process.stderr.write(`undo: ${result.error}\n`);
        return 2;
      }
      console.log(`undo: OK — reverted txn ${result.txnId}`);
      return 0;
    }
    case "metrics": {
      const out = await runMetrics(loaded);
      console.log(`metrics: ${rel(out)}`);
      return 0;
    }
    case "churn": {
      const repoName = args[0];
      if (!repoName) {
        process.stderr.write("churn: missing <repo> argument\n");
        return 3;
      }
      let topN: number | undefined;
      let sinceDays: number | undefined;
      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--top" && i + 1 < args.length) {
          topN = Number(args[i + 1]);
          i++;
        } else if (args[i] === "--since-days" && i + 1 < args.length) {
          sinceDays = Number(args[i + 1]);
          i++;
        }
      }
      const out = await runChurn(loaded, repoName, { topN, sinceDays });
      console.log(`churn: ${rel(out)}`);
      return 0;
    }
    case "ownership": {
      const target = args[0];
      if (!target) {
        process.stderr.write("ownership: missing <path> argument\n");
        return 3;
      }
      const r = runOwnership(loaded, target);
      console.log(`  path:       ${r.path}`);
      console.log(`  exists:     ${r.exists ? "yes" : "no"}`);
      console.log(`  in repo:    ${r.insideRepo ? r.insideRepo.name : "(workspace)"}`);
      console.log(`  file class: ${r.fileClass}`);
      console.log(`  editor:     ${r.editor}`);
      if (r.claimedBy.length) {
        console.log(`  claimed by:`);
        for (const c of r.claimedBy) {
          console.log(`    - ${c.repo} ${c.blockId} (${c.status}, ${c.kind})`);
        }
      }
      if (r.rationale.length) {
        console.log(`  notes:`);
        for (const note of r.rationale) console.log(`    - ${note}`);
      }
      return 0;
    }
    case "audit": {
      let only: string[] | undefined;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--only" && i + 1 < args.length) {
          only = (args[i + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          i++;
        }
      }
      const { path, result } = await runAuditCommand(loaded, { only });
      console.log(`audit: ${rel(path)}`);
      console.log(`  ${summarizeAudit(result)}`);
      if (result.errors.length > 0) return 2;
      return 0;
    }
    case "doctor": {
      const result = runDoctor(loaded);
      for (const c of result.checks) {
        const tag = c.ok ? "PASS" : "FAIL";
        console.log(`  [${tag}] ${c.name} — ${c.detail}`);
      }
      console.log(
        `doctor: ${result.pass ? "PASS" : "FAIL"} (${result.checks.filter((c) => c.ok).length}/${result.checks.length})`,
      );
      return result.pass ? 0 : 2;
    }
    case "verify": {
      const target = args[0];
      if (!target) {
        process.stderr.write("verify: missing <path> argument\n");
        return 3;
      }
      const result = runVerify(loaded, target);
      if (result.error) {
        process.stderr.write(`verify: ${result.error}\n`);
        return 2;
      }
      for (const d of result.details) {
        const tag = d.ok ? "OK  " : "DIFF";
        console.log(`  [${tag}] ${d.source}`);
        if (!d.ok) {
          console.log(`         expected ${d.expected}`);
          console.log(`         actual   ${d.actual}`);
        }
      }
      console.log(
        `verify: ${result.ok ? "UNCHANGED" : "STALE"} — generator=${result.generator} generated_at=${result.generatedAt}`,
      );
      return result.ok ? 0 : 2;
    }
    default:
      process.stderr.write(`governor: unknown command '${cmd}'\n\n`);
      process.stdout.write(USAGE);
      return 3;
  }
}

main(process.argv)
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`governor: ${(err as Error).message}\n`);
    process.exit(1);
  });
