import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { LoadedConfig, RepoConfig } from "./config.ts";
import { listWorktrees, type WorktreeInfo, isGitRepo } from "./git.ts";

export interface RepoView {
  config: RepoConfig;
  absPath: string;
  exists: boolean;
  isGit: boolean;
  worktrees: WorktreeInfo[];
  activeWorktree: WorktreeInfo | null;
}

export function describeRepo(
  loaded: LoadedConfig,
  repo: RepoConfig,
): RepoView {
  const absPath = resolve(loaded.workspaceRoot, repo.path);
  const exists = existsSync(absPath);
  const isGit = exists && isGitRepo(absPath);
  const worktrees = isGit ? listWorktrees(absPath) : [];
  const activeWorktree = pickActiveWorktree(worktrees, absPath);
  return { config: repo, absPath, exists, isGit, worktrees, activeWorktree };
}

function pickActiveWorktree(
  worktrees: WorktreeInfo[],
  repoAbs: string,
): WorktreeInfo | null {
  const claudeWorktrees = worktrees.filter((w) =>
    w.path.replace(/\\/g, "/").includes("/.claude/worktrees/"),
  );
  if (claudeWorktrees.length === 1) return claudeWorktrees[0] ?? null;
  if (claudeWorktrees.length > 1) {
    return [...claudeWorktrees].sort((a, b) => b.path.localeCompare(a.path))[0] ?? null;
  }
  return worktrees.find((w) => resolve(w.path) === resolve(repoAbs)) ?? null;
}

export function listManifestFiles(
  manifestsDir: string,
): string[] {
  if (!existsSync(manifestsDir)) return [];
  return readdirSync(manifestsDir)
    .filter((f) => /^block-\d{3}(-[a-z0-9-]+)?\.md$/.test(f))
    .map((f) => resolve(manifestsDir, f))
    .filter((p) => statSync(p).isFile())
    .sort();
}

export function manifestsActiveDir(
  loaded: LoadedConfig,
  view: RepoView,
): string | null {
  if (!view.config.manifests_active) return null;
  const base = view.activeWorktree?.path ?? view.absPath;
  return resolve(base, view.config.manifests_active);
}

export function stateFilePath(view: RepoView): string | null {
  if (!view.config.state_file) return null;
  const base = view.activeWorktree?.path ?? view.absPath;
  return resolve(base, view.config.state_file);
}
