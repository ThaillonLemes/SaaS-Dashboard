import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import { buildSources, formatFooter } from "../footer.ts";
import { listTransactions, readTransaction } from "../ledger.ts";
import { describeRepo, listManifestFiles, manifestsActiveDir } from "../workspace.ts";
import { parseManifestFile } from "../manifest/parse.ts";

const DAY_MS = 86_400_000;

interface AuditSnapshot {
  date: string;
  path: string;
  errors: number;
  warnings: number;
  rulesExecuted: number;
}

interface IntegrationRecord {
  txnId: string;
  startedAt: string;
  completedAt: string;
  repo: string;
  branch: string;
  durationMs: number;
}

interface ManifestSummary {
  repo: string;
  active: number;
  inProgress: number;
  ageBuckets: { p50: number; p90: number; max: number };
  withoutFrontmatter: number;
}

export async function runMetrics(loaded: LoadedConfig): Promise<string> {
  const lockPath = resolve(loaded.workspaceRoot, loaded.config.orchestrator.lock_file);
  const lock = await acquireLock(lockPath);
  try {
    const sourcePaths: string[] = [];
    const audits = collectAudits(loaded, sourcePaths);
    const integrations = collectIntegrations(loaded, sourcePaths);
    const manifests = collectManifestSummaries(loaded, sourcePaths);

    const lines: string[] = [];
    lines.push("# Governor Metrics");
    lines.push("");
    lines.push("_DERIVED — regenerate via `governor metrics`._");
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC.`);
    lines.push("");

    lines.push("## Active manifests per repo");
    lines.push("");
    lines.push("| Repo | Active | InProgress | Without frontmatter | Age p50 (d) | Age p90 (d) | Age max (d) |");
    lines.push("|------|-------:|-----------:|---------------------:|------------:|------------:|------------:|");
    for (const m of manifests) {
      lines.push(
        `| ${m.repo} | ${m.active} | ${m.inProgress} | ${m.withoutFrontmatter} | ${m.ageBuckets.p50} | ${m.ageBuckets.p90} | ${m.ageBuckets.max} |`,
      );
    }
    lines.push("");

    lines.push("## Audit trail (last 12 runs)");
    lines.push("");
    if (audits.length === 0) {
      lines.push("_no audit reports recorded yet_");
    } else {
      lines.push("| Date | Errors | Warnings | Rules |");
      lines.push("|------|-------:|---------:|------:|");
      for (const a of audits.slice(-12)) {
        lines.push(`| ${a.date} | ${a.errors} | ${a.warnings} | ${a.rulesExecuted} |`);
      }
      const cur = audits[audits.length - 1]!;
      const prev = audits.length >= 2 ? audits[audits.length - 2] : null;
      lines.push("");
      if (prev) {
        const dErr = cur.errors - prev.errors;
        const dWarn = cur.warnings - prev.warnings;
        lines.push(
          `Latest delta vs previous run: errors ${signed(dErr)}, warnings ${signed(dWarn)}.`,
        );
      }
    }
    lines.push("");

    lines.push("## Integration ledger");
    lines.push("");
    if (integrations.length === 0) {
      lines.push("_no completed integrations recorded yet (dry-runs excluded)_");
    } else {
      lines.push(`Total completed integrations: ${integrations.length}.`);
      lines.push("");
      const latencies = integrations.map((i) => i.durationMs);
      const p50 = percentile(latencies, 0.5);
      const p90 = percentile(latencies, 0.9);
      const max = Math.max(...latencies);
      lines.push(`Latency (ms): p50 ${p50}, p90 ${p90}, max ${max}.`);
      lines.push("");
      lines.push("| Started | Repo | Branch | Duration (ms) | Txn |");
      lines.push("|---------|------|--------|--------------:|-----|");
      for (const i of integrations.slice(-12)) {
        lines.push(
          `| ${i.startedAt.slice(0, 19).replace("T", " ")} | ${i.repo} | ${i.branch} | ${i.durationMs} | \`${i.txnId}\` |`,
        );
      }
    }
    lines.push("");

    lines.push("## Throughput");
    lines.push("");
    const buckets = throughputBuckets(integrations);
    if (buckets.length === 0) {
      lines.push("_insufficient data — needs ≥ 2 weeks of integration history_");
    } else {
      lines.push("| Week starting | Integrations |");
      lines.push("|---------------|-------------:|");
      for (const b of buckets) lines.push(`| ${b.start} | ${b.count} |`);
    }
    lines.push("");

    const outDir = resolve(loaded.workspaceRoot, loaded.config.governance.outputs_dir);
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "metrics.md");
    const footer = formatFooter({
      generator: "metrics",
      generatedAt: new Date().toISOString(),
      sources: buildSources(loaded.workspaceRoot, sourcePaths),
    });
    writeFileSync(outPath, lines.join("\n") + "\n" + footer, "utf8");
    return outPath;
  } finally {
    lock.release();
  }
}

function collectAudits(
  loaded: LoadedConfig,
  sourcePaths: string[],
): AuditSnapshot[] {
  const outDir = resolve(loaded.workspaceRoot, loaded.config.governance.outputs_dir);
  if (!existsSync(outDir)) return [];
  const re = /^audit-(\d{4}-\d{2}-\d{2})\.md$/;
  const out: AuditSnapshot[] = [];
  for (const f of readdirSync(outDir).sort()) {
    const m = f.match(re);
    if (!m) continue;
    const abs = resolve(outDir, f);
    sourcePaths.push(abs);
    const raw = readFileSync(abs, "utf8");
    const errors = numFrom(raw, /^- Errors:\s+(\d+)/m);
    const warnings = numFrom(raw, /^- Warnings:\s+(\d+)/m);
    const rulesExecuted = numFrom(raw, /^- Rules executed:\s+(\d+)/m);
    out.push({ date: m[1] ?? "", path: abs, errors, warnings, rulesExecuted });
  }
  return out;
}

function numFrom(text: string, re: RegExp): number {
  const m = text.match(re);
  return m && m[1] ? Number(m[1]) : 0;
}

function collectIntegrations(
  loaded: LoadedConfig,
  sourcePaths: string[],
): IntegrationRecord[] {
  const ledgerDir = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.transaction_ledger,
  );
  if (!existsSync(ledgerDir)) return [];
  const out: IntegrationRecord[] = [];
  for (const id of listTransactions(ledgerDir)) {
    const txn = readTransaction(ledgerDir, id);
    if (!txn) continue;
    if (txn.command !== "integrate") continue;
    if (!txn.completed_at) continue;
    if (txn.undone_at) continue;
    const gitMerge = txn.operations.find((op) => op.kind === "git-merge");
    if (!gitMerge) continue;
    sourcePaths.push(resolve(ledgerDir, `${id}.json`));
    out.push({
      txnId: id,
      startedAt: txn.started_at,
      completedAt: txn.completed_at,
      repo: String(gitMerge.repo ?? "?"),
      branch: String(gitMerge.branch ?? "?"),
      durationMs:
        new Date(txn.completed_at).getTime() - new Date(txn.started_at).getTime(),
    });
  }
  return out;
}

function collectManifestSummaries(
  loaded: LoadedConfig,
  sourcePaths: string[],
): ManifestSummary[] {
  const now = Date.now();
  const out: ManifestSummary[] = [];
  for (const repo of loaded.config.repos) {
    const view = describeRepo(loaded, repo);
    const dir = manifestsActiveDir(loaded, view);
    let active = 0;
    let inProgress = 0;
    let withoutFm = 0;
    const ages: number[] = [];
    if (dir && existsSync(dir)) {
      for (const f of listManifestFiles(dir)) {
        sourcePaths.push(f);
        active++;
        const p = parseManifestFile(f);
        if (!p.frontmatter) {
          withoutFm++;
          continue;
        }
        if (p.frontmatter.status === "InProgress") inProgress++;
        const created = p.frontmatter.created_at;
        if (typeof created === "string") {
          const t = Date.parse(created);
          if (Number.isFinite(t)) {
            ages.push(Math.floor((now - t) / DAY_MS));
          }
        }
      }
    }
    out.push({
      repo: repo.name,
      active,
      inProgress,
      withoutFrontmatter: withoutFm,
      ageBuckets: {
        p50: percentile(ages, 0.5),
        p90: percentile(ages, 0.9),
        max: ages.length ? Math.max(...ages) : 0,
      },
    });
  }
  return out;
}

function percentile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx] ?? 0;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function throughputBuckets(
  integrations: IntegrationRecord[],
): Array<{ start: string; count: number }> {
  if (integrations.length === 0) return [];
  const byWeek = new Map<string, number>();
  for (const i of integrations) {
    const d = new Date(i.completedAt);
    const day = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([start, count]) => ({ start, count }));
}
