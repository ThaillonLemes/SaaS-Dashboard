import { existsSync, mkdirSync, renameSync, readFileSync } from "node:fs";
import { dirname, basename, resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import type { LoadedConfig, RepoConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import {
  newTransaction,
  type LedgerOperation,
  type TransactionHandle,
} from "../ledger.ts";
import { head, isDirty, currentBranch, recentCommits } from "../git.ts";
import { describeRepo, listManifestFiles } from "../workspace.ts";
import { parseManifestFile } from "../manifest/parse.ts";

export interface IntegrateOptions {
  dryRun: boolean;
}

export interface IntegrateStep {
  description: string;
  applied: boolean;
}

export interface IntegrateResult {
  repoName: string;
  branch: string;
  dryRun: boolean;
  ok: boolean;
  txnId: string | null;
  steps: IntegrateStep[];
  shaBefore: string | null;
  shaAfter: string | null;
  movedManifests: Array<{ from: string; to: string }>;
  error: string | null;
}

export async function runIntegrate(
  loaded: LoadedConfig,
  repoName: string,
  branch: string,
  options: IntegrateOptions,
): Promise<IntegrateResult> {
  const lockPath = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.lock_file,
  );
  const lock = await acquireLock(lockPath);

  const result: IntegrateResult = {
    repoName,
    branch,
    dryRun: options.dryRun,
    ok: false,
    txnId: null,
    steps: [],
    shaBefore: null,
    shaAfter: null,
    movedManifests: [],
    error: null,
  };
  let txn: TransactionHandle | null = null;
  try {
    const repo = loaded.config.repos.find((r) => r.name === repoName);
    if (!repo) throw new Error(`repo not in config: ${repoName}`);
    const repoAbs = resolve(loaded.workspaceRoot, repo.path);
    if (!existsSync(repoAbs)) throw new Error(`repo path missing: ${repo.path}`);

    const view = describeRepo(loaded, repo);
    if (!view.isGit) throw new Error(`${repoName} is not a git repository`);

    if (isDirty(repoAbs)) {
      throw new Error(`${repoName} main worktree is dirty; commit or stash before integrate`);
    }

    if (!branchExists(repoAbs, branch)) {
      throw new Error(`branch '${branch}' not found in ${repoName}`);
    }
    if (isAncestor(repoAbs, branch, "HEAD")) {
      throw new Error(`branch '${branch}' is already merged into HEAD of ${repoName}`);
    }

    const onBranch = currentBranch(repoAbs);
    if (onBranch !== "main" && onBranch !== "master") {
      result.steps.push({
        description: `target branch is '${onBranch}', expected 'main' or 'master'`,
        applied: false,
      });
      throw new Error(`${repoName} is on '${onBranch}'; expected 'main' or 'master'`);
    }

    result.shaBefore = head(repoAbs);

    const blockManifests = findCompletedManifestsOnBranch(loaded, repo, branch);
    if (blockManifests.length === 0) {
      result.steps.push({
        description: "no Complete-status manifest found on branch — proceeding without archival",
        applied: false,
      });
    }

    const ledgerDir = resolve(
      loaded.workspaceRoot,
      loaded.config.orchestrator.transaction_ledger,
    );
    txn = newTransaction(ledgerDir, "integrate", [repoName, branch]);
    result.txnId = txn.id;

    if (options.dryRun) {
      result.steps.push({
        description: `[dry-run] git merge --no-ff ${branch} on ${repo.path}`,
        applied: false,
      });
      for (const m of blockManifests) {
        const archive = archivePathFor(repo, m);
        if (!archive) continue;
        result.steps.push({
          description: `[dry-run] move ${relative(loaded.workspaceRoot, m).replace(/\\/g, "/")} → ${relative(loaded.workspaceRoot, archive).replace(/\\/g, "/")}`,
          applied: false,
        });
      }
      result.ok = true;
      txn.finalize();
      return result;
    }

    const mergeMsg = `integrate(${branch}): governor txn ${txn.id}`;
    git(repoAbs, ["merge", "--no-ff", "-m", mergeMsg, branch]);
    const shaAfter = head(repoAbs);
    result.shaAfter = shaAfter;
    const mergeOp: LedgerOperation = {
      kind: "git-merge",
      repo: repoName,
      repo_path: repo.path,
      branch,
      sha_before: result.shaBefore,
      sha_after: shaAfter,
    };
    txn.append(mergeOp);
    result.steps.push({
      description: `merged ${branch} into ${onBranch} (${result.shaBefore.slice(0, 7)} → ${shaAfter.slice(0, 7)})`,
      applied: true,
    });

    for (const m of blockManifests) {
      const archive = archivePathFor(repo, m);
      if (!archive) continue;
      mkdirSync(dirname(archive), { recursive: true });
      renameSync(m, archive);
      txn.append({
        kind: "file-move",
        repo: repoName,
        from: relative(loaded.workspaceRoot, m).replace(/\\/g, "/"),
        to: relative(loaded.workspaceRoot, archive).replace(/\\/g, "/"),
      });
      result.movedManifests.push({
        from: relative(loaded.workspaceRoot, m).replace(/\\/g, "/"),
        to: relative(loaded.workspaceRoot, archive).replace(/\\/g, "/"),
      });
      result.steps.push({
        description: `archived ${basename(m)}`,
        applied: true,
      });
    }

    txn.finalize();
    result.ok = true;
    return result;
  } catch (err) {
    result.error = (err as Error).message;
    if (txn) txn.abort(result.error);
    return result;
  } finally {
    lock.release();
  }
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function branchExists(repo: string, branch: string): boolean {
  try {
    git(repo, ["rev-parse", "--verify", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

function isAncestor(repo: string, candidate: string, ref: string): boolean {
  try {
    git(repo, ["merge-base", "--is-ancestor", candidate, ref]);
    return true;
  } catch {
    return false;
  }
}

function findCompletedManifestsOnBranch(
  loaded: LoadedConfig,
  repo: RepoConfig,
  branch: string,
): string[] {
  if (!repo.manifests_active) return [];
  const repoAbs = resolve(loaded.workspaceRoot, repo.path);
  let worktreePath: string | null = null;
  try {
    const wts = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: repoAbs,
      encoding: "utf8",
    });
    const blocks = wts.split(/\n\n/);
    for (const blk of blocks) {
      if (blk.includes(`branch refs/heads/${branch}`)) {
        const m = blk.match(/^worktree (.+)/m);
        if (m && m[1]) worktreePath = m[1];
      }
    }
  } catch {
    return [];
  }
  if (!worktreePath) return [];
  const dir = resolve(worktreePath, repo.manifests_active);
  if (!existsSync(dir)) return [];
  return listManifestFiles(dir).filter((f) => {
    const p = parseManifestFile(f);
    if (!p.frontmatter) return false;
    return p.frontmatter.status === "Complete";
  });
}

void readFileSync;

function archivePathFor(repo: RepoConfig, manifest: string): string | null {
  if (!repo.manifests_archive || !repo.manifests_active) return null;
  const filename = basename(manifest);
  const norm = manifest.replace(/\\/g, "/");
  const idx = norm.lastIndexOf(repo.manifests_active);
  if (idx === -1) return null;
  const repoRoot = norm.slice(0, idx);
  return resolve(repoRoot, repo.manifests_archive, filename);
}

void recentCommits;
