import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import { buildSources, formatFooter } from "../footer.ts";
import { describeRepo, stateFilePath } from "../workspace.ts";
import { head as gitHead, recentCommits } from "../git.ts";

export async function runState(loaded: LoadedConfig): Promise<string> {
  const lockPath = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.lock_file,
  );
  const lock = await acquireLock(lockPath);
  try {
    const lines: string[] = [];
    const sourcePaths: string[] = [];

    lines.push("# Workspace State (proposed)");
    lines.push("");
    lines.push(
      "_DERIVED — regenerate via `governor state`. Promotion to `STATE.md` is a Governor action._",
    );
    lines.push("");
    lines.push("## Repos");
    lines.push("");
    lines.push("| Repo | Worktree branch | Worktree HEAD | main HEAD | Per-repo STATE.md |");
    lines.push("|------|------------------|----------------|-----------|---------------------|");

    for (const repo of loaded.config.repos) {
      const view = describeRepo(loaded, repo);
      const branch = view.activeWorktree?.branch ?? "—";
      const wtHead = abbrev(view.activeWorktree?.head ?? "");
      const mainHead = view.isGit ? safeShort(view.absPath) : "—";
      const stPath = stateFilePath(view);
      const stStatus = stPath && existsSync(stPath) ? "present" : "—";
      if (stPath && existsSync(stPath)) sourcePaths.push(stPath);
      lines.push(
        `| ${repo.name} | ${branch} | ${wtHead || "—"} | ${mainHead} | ${stStatus} |`,
      );
    }

    lines.push("");
    lines.push("## Per-repo summaries");
    lines.push("");
    for (const repo of loaded.config.repos) {
      const view = describeRepo(loaded, repo);
      const stPath = stateFilePath(view);
      lines.push(`### ${repo.name}`);
      lines.push("");
      if (stPath && existsSync(stPath)) {
        const summary = extractSummary(stPath);
        lines.push(summary || "_no summary extracted_");
      } else if (!view.exists) {
        lines.push(`_repo path missing: ${repo.path}_`);
      } else if (!view.isGit) {
        lines.push("_not a git repository_");
      } else {
        lines.push("_no per-repo STATE.md configured_");
      }
      if (view.isGit) {
        try {
          const commits = recentCommits(view.absPath, "HEAD", 3);
          if (commits.length > 0) {
            lines.push("");
            lines.push("Recent commits on main:");
            for (const c of commits) {
              lines.push(`- \`${c.sha.slice(0, 7)}\` ${c.subject} (${c.authorDate})`);
            }
          }
        } catch {
          // ignore
        }
      }
      lines.push("");
    }

    const sources = buildSources(loaded.workspaceRoot, sourcePaths);
    const footer = formatFooter({
      generator: "state",
      generatedAt: new Date().toISOString(),
      sources,
    });

    const outPath = resolve(loaded.workspaceRoot, "STATE.proposed.md");
    const content = lines.join("\n") + "\n" + footer;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, content, "utf8");
    return outPath;
  } finally {
    lock.release();
  }
}

function abbrev(sha: string): string {
  return sha ? sha.slice(0, 7) : "";
}

function safeShort(repoPath: string): string {
  try {
    return abbrev(gitHead(repoPath));
  } catch {
    return "—";
  }
}

function extractSummary(stPath: string): string {
  try {
    const raw = readFileSync(stPath, "utf8");
    const lines = raw.split(/\r?\n/);
    const out: string[] = [];
    for (const line of lines) {
      if (out.length === 0 && (!line.trim() || line.startsWith("#"))) continue;
      if (line.startsWith("##")) break;
      out.push(line);
      if (out.length >= 12) break;
    }
    return out.join("\n").trim();
  } catch {
    return "";
  }
}
