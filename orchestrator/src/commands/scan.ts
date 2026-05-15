import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import { head as gitHead, isDirty } from "../git.ts";
import {
  describeRepo,
  listManifestFiles,
  manifestsActiveDir,
} from "../workspace.ts";

export interface ScanCacheRepo {
  name: string;
  exists: boolean;
  is_git: boolean;
  worktrees: Array<{
    path: string;
    branch: string;
    head: string;
    dirty: boolean;
  }>;
  active_worktree: string | null;
  main_head: string | null;
  manifests_active: string[];
}

export interface ScanCache {
  scanned_at: string;
  workspace_root: string;
  repos: Record<string, ScanCacheRepo>;
}

export async function runScan(loaded: LoadedConfig): Promise<ScanCache> {
  const lockPath = resolve(loaded.workspaceRoot, loaded.config.orchestrator.lock_file);
  const lock = await acquireLock(lockPath);
  try {
    const cache: ScanCache = {
      scanned_at: new Date().toISOString(),
      workspace_root: loaded.workspaceRoot,
      repos: {},
    };

    for (const repo of loaded.config.repos) {
      const view = describeRepo(loaded, repo);
      const entry: ScanCacheRepo = {
        name: repo.name,
        exists: view.exists,
        is_git: view.isGit,
        worktrees: [],
        active_worktree: view.activeWorktree?.path
          ? toRel(loaded.workspaceRoot, view.activeWorktree.path)
          : null,
        main_head: null,
        manifests_active: [],
      };

      if (view.isGit) {
        try {
          entry.main_head = gitHead(view.absPath);
        } catch {
          entry.main_head = null;
        }
        for (const wt of view.worktrees) {
          entry.worktrees.push({
            path: toRel(loaded.workspaceRoot, wt.path),
            branch: wt.branch,
            head: wt.head,
            dirty: safeDirty(wt.path),
          });
        }
      }

      const manifestsDir = manifestsActiveDir(loaded, view);
      if (manifestsDir) {
        entry.manifests_active = listManifestFiles(manifestsDir).map((p) =>
          toRel(loaded.workspaceRoot, p),
        );
      }

      cache.repos[repo.name] = entry;
    }

    const cachePath = resolve(loaded.workspaceRoot, loaded.config.orchestrator.cache_file);
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache, null, 2) + "\n", "utf8");
    return cache;
  } finally {
    lock.release();
  }
}

function safeDirty(path: string): boolean {
  try {
    return isDirty(path);
  } catch {
    return false;
  }
}

function toRel(root: string, abs: string): string {
  return relative(root, abs).replace(/\\/g, "/") || ".";
}
