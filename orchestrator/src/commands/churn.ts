import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import { buildSources, formatFooter } from "../footer.ts";
import { describeRepo } from "../workspace.ts";

export interface ChurnOptions {
  topN?: number;
  sinceDays?: number;
}

export async function runChurn(
  loaded: LoadedConfig,
  repoName: string,
  options: ChurnOptions = {},
): Promise<string> {
  const topN = options.topN ?? 20;
  const sinceDays = options.sinceDays ?? 90;
  const lockPath = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.lock_file,
  );
  const lock = await acquireLock(lockPath);
  try {
    const repo = loaded.config.repos.find((r) => r.name === repoName);
    if (!repo) throw new Error(`repo not in config: ${repoName}`);
    const view = describeRepo(loaded, repo);
    if (!view.isGit) throw new Error(`${repoName} is not a git repository`);

    const repoAbs = resolve(loaded.workspaceRoot, repo.path);
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);

    let raw: string;
    try {
      raw = execFileSync(
        "git",
        ["log", `--since=${since}`, "--pretty=format:", "--name-only"],
        {
          cwd: repoAbs,
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
        },
      );
    } catch (err) {
      raw = "";
      void err;
    }

    const counts = new Map<string, number>();
    for (const line of raw.split(/\r?\n/)) {
      const f = line.trim();
      if (!f) continue;
      if (skipPath(f)) continue;
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
    const totalCommits = countCommitsInWindow(repoAbs, since);

    const lines: string[] = [];
    lines.push(`# Churn — ${repoName}`);
    lines.push("");
    lines.push(`_DERIVED — regenerate via \`governor churn ${repoName}\`._`);
    lines.push("");
    lines.push(`Window: last ${sinceDays} days (since ${since}). Total commits: ${totalCommits}.`);
    lines.push("");
    if (sorted.length === 0) {
      lines.push("_no file modifications in window_");
    } else {
      lines.push(`Top ${sorted.length} most-modified files:`);
      lines.push("");
      lines.push("| Rank | Modifications | File |");
      lines.push("|-----:|--------------:|------|");
      sorted.forEach(([file, count], i) => {
        lines.push(`| ${i + 1} | ${count} | \`${file}\` |`);
      });
    }
    lines.push("");

    const outDir = resolve(
      loaded.workspaceRoot,
      loaded.config.governance.outputs_dir,
    );
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `churn-${repoName}.md`);
    const sources = existsSync(resolve(repoAbs, ".git/HEAD"))
      ? [resolve(repoAbs, ".git/HEAD")]
      : [];
    const footer = formatFooter({
      generator: `churn:${repoName}`,
      generatedAt: new Date().toISOString(),
      sources: buildSources(loaded.workspaceRoot, sources),
    });
    writeFileSync(outPath, lines.join("\n") + "\n" + footer, "utf8");
    return outPath;
  } finally {
    lock.release();
  }
}

function skipPath(p: string): boolean {
  if (p.startsWith("Binaries/")) return true;
  if (p.startsWith("Intermediate/")) return true;
  if (p.startsWith("Saved/")) return true;
  if (p.startsWith("DerivedDataCache/")) return true;
  if (p.startsWith("target/")) return true;
  if (p.startsWith("node_modules/")) return true;
  if (p.includes("/node_modules/")) return true;
  if (p.includes("/target/")) return true;
  if (p.endsWith(".lock")) return true;
  return false;
}

function countCommitsInWindow(repoAbs: string, since: string): number {
  try {
    const out = execFileSync(
      "git",
      ["rev-list", "--count", `--since=${since}`, "HEAD"],
      { cwd: repoAbs, encoding: "utf8" },
    ).trim();
    return Number(out) || 0;
  } catch {
    return 0;
  }
}
