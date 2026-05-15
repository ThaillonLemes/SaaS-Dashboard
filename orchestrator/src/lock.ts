import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const STALE_AFTER_MS = 5 * 60 * 1000;
const POLL_MS = 200;

export interface LockHandle {
  path: string;
  release: () => void;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "EPERM";
  }
}

function readLockOwner(path: string): { pid: number; mtimeMs: number } | null {
  try {
    const raw = readFileSync(path, "utf8").trim();
    const pid = Number(raw.split(/\s+/)[0]);
    if (!Number.isFinite(pid)) return null;
    const stat = statSync(path);
    return { pid, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

export async function acquireLock(
  lockPath: string,
  timeoutMs = 30000,
): Promise<LockHandle> {
  mkdirSync(dirname(lockPath), { recursive: true });
  const start = Date.now();
  while (true) {
    try {
      writeFileSync(lockPath, `${process.pid} ${new Date().toISOString()}\n`, {
        flag: "wx",
      });
      return {
        path: lockPath,
        release: () => {
          try {
            unlinkSync(lockPath);
          } catch {
            // already released
          }
        },
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
    }

    const owner = readLockOwner(lockPath);
    if (owner) {
      const stale = Date.now() - owner.mtimeMs > STALE_AFTER_MS;
      const dead = !pidAlive(owner.pid);
      if (stale || dead) {
        try {
          unlinkSync(lockPath);
        } catch {
          // race — loop and retry
        }
        continue;
      }
    }

    if (Date.now() - start >= timeoutMs) {
      const ownerStr = owner ? `PID ${owner.pid}` : "unknown PID";
      throw new Error(
        `governor: another orchestrator run is in progress (${ownerStr}). ` +
          `If stale, delete ${lockPath}.`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}
