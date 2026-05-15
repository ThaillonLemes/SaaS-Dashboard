import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export class GitError extends Error {
  constructor(
    message: string,
    public readonly cwd: string,
    public readonly args: string[],
  ) {
    super(message);
  }
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string | Buffer };
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr
        : e.stderr?.toString("utf8") ?? "";
    throw new GitError(
      `git ${args.join(" ")} failed in ${cwd}: ${stderr || e.message}`,
      cwd,
      args,
    );
  }
}

export function isGitRepo(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    git(path, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

export function head(path: string): string {
  return git(path, ["rev-parse", "HEAD"]);
}

export function currentBranch(path: string): string {
  return git(path, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export function listWorktrees(repoPath: string): WorktreeInfo[] {
  const out = git(repoPath, ["worktree", "list", "--porcelain"]);
  const entries: WorktreeInfo[] = [];
  let cur: Partial<WorktreeInfo> = {};
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (cur.path) entries.push(fillWorktree(cur));
      cur = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("HEAD ")) {
      cur.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      cur.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "" && cur.path) {
      entries.push(fillWorktree(cur));
      cur = {};
    }
  }
  if (cur.path) entries.push(fillWorktree(cur));
  return entries.map((w) => ({ ...w, path: resolve(w.path) }));
}

function fillWorktree(w: Partial<WorktreeInfo>): WorktreeInfo {
  return {
    path: w.path ?? "",
    branch: w.branch ?? "(detached)",
    head: w.head ?? "",
  };
}

export interface CommitInfo {
  sha: string;
  subject: string;
  authorDate: string;
}

export function recentCommits(
  repoPath: string,
  ref = "HEAD",
  limit = 10,
): CommitInfo[] {
  const out = git(repoPath, [
    "log",
    `-${limit}`,
    "--format=%H%x1f%s%x1f%aI",
    ref,
  ]);
  if (!out) return [];
  return out.split(/\r?\n/).map((line) => {
    const [sha = "", subject = "", authorDate = ""] = line.split("\x1f");
    return { sha, subject, authorDate };
  });
}

export function isDirty(path: string): boolean {
  const out = git(path, ["status", "--porcelain"]);
  return out.length > 0;
}
