import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import {
  latestUndoableTransaction,
  listTransactions,
  markTransactionUndone,
  readTransaction,
  type LedgerOperation,
} from "../ledger.ts";

export interface UndoStep {
  description: string;
  applied: boolean;
  error?: string;
}

export interface UndoResult {
  txnId: string | null;
  ok: boolean;
  steps: UndoStep[];
  error: string | null;
}

export async function runUndo(
  loaded: LoadedConfig,
  targetId?: string,
): Promise<UndoResult> {
  const lockPath = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.lock_file,
  );
  const lock = await acquireLock(lockPath);
  const ledgerDir = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.transaction_ledger,
  );
  const result: UndoResult = {
    txnId: null,
    ok: false,
    steps: [],
    error: null,
  };
  try {
    const id = targetId ?? latestUndoableTransaction(ledgerDir);
    if (!id) {
      result.error = "no undoable transaction found";
      return result;
    }
    result.txnId = id;
    const txn = readTransaction(ledgerDir, id);
    if (!txn) {
      result.error = `transaction ${id} not found`;
      return result;
    }
    if (txn.undone_at) {
      result.error = `transaction ${id} already undone at ${txn.undone_at}`;
      return result;
    }
    if (!txn.completed_at) {
      result.error = `transaction ${id} did not complete (aborted or in flight); refusing to undo`;
      return result;
    }
    if (listTransactions(ledgerDir).slice(-1)[0] !== id && !targetId) {
      result.error = `transaction ${id} is not the latest; pass an explicit id to undo out-of-order`;
      return result;
    }

    const reversed = [...txn.operations].reverse();
    for (const op of reversed) {
      try {
        const desc = applyInverse(loaded, op);
        result.steps.push({ description: desc, applied: true });
      } catch (err) {
        result.steps.push({
          description: `failed: ${op.kind}`,
          applied: false,
          error: (err as Error).message,
        });
        result.error = `inverse of ${op.kind} failed: ${(err as Error).message}`;
        return result;
      }
    }
    markTransactionUndone(ledgerDir, id, "governor undo");
    result.ok = true;
    return result;
  } finally {
    lock.release();
  }
}

function applyInverse(loaded: LoadedConfig, op: LedgerOperation): string {
  switch (op.kind) {
    case "git-merge": {
      const repo = loaded.config.repos.find((r) => r.name === op.repo);
      if (!repo) throw new Error(`unknown repo: ${op.repo}`);
      const repoAbs = resolve(loaded.workspaceRoot, repo.path);
      const shaBefore = String(op.sha_before);
      if (!/^[0-9a-f]{7,40}$/.test(shaBefore)) {
        throw new Error(`invalid sha_before: ${shaBefore}`);
      }
      execFileSync("git", ["reset", "--hard", shaBefore], {
        cwd: repoAbs,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return `git reset --hard ${shaBefore.slice(0, 7)} on ${op.repo}`;
    }
    case "file-move": {
      const from = resolve(loaded.workspaceRoot, String(op.from));
      const to = resolve(loaded.workspaceRoot, String(op.to));
      if (!existsSync(to)) {
        throw new Error(`destination missing: ${op.to}`);
      }
      mkdirSync(dirname(from), { recursive: true });
      renameSync(to, from);
      return `moved ${rel(loaded, to)} → ${rel(loaded, from)}`;
    }
    default:
      throw new Error(`no inverse for op kind '${op.kind}'`);
  }
}

function rel(loaded: LoadedConfig, abs: string): string {
  return relative(loaded.workspaceRoot, abs).replace(/\\/g, "/");
}
