import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface LedgerOperation {
  kind: string;
  [k: string]: unknown;
}

export interface Transaction {
  id: string;
  command: string;
  args: string[];
  started_at: string;
  completed_at: string | null;
  undone_at?: string;
  undone_by?: string;
  operations: LedgerOperation[];
}

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function ensureLedgerDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export interface TransactionHandle {
  id: string;
  path: string;
  append: (op: LedgerOperation) => void;
  finalize: () => void;
  abort: (error: string) => void;
}

export function newTransaction(
  ledgerDir: string,
  command: string,
  args: string[],
): TransactionHandle {
  ensureLedgerDir(ledgerDir);
  const id = `${isoStamp()}-${command.replace(/\s+/g, "_")}`;
  const path = resolve(ledgerDir, `${id}.json`);
  const txn: Transaction = {
    id,
    command,
    args,
    started_at: new Date().toISOString(),
    completed_at: null,
    operations: [],
  };
  const flush = () => writeFileSync(path, JSON.stringify(txn, null, 2) + "\n", "utf8");
  flush();
  return {
    id,
    path,
    append(op) {
      txn.operations.push(op);
      flush();
    },
    finalize() {
      txn.completed_at = new Date().toISOString();
      flush();
    },
    abort(error) {
      (txn as Transaction & { aborted_at?: string; aborted_error?: string }).aborted_at = new Date().toISOString();
      (txn as Transaction & { aborted_error?: string }).aborted_error = error;
      flush();
    },
  };
}

export function markTransactionUndone(
  ledgerDir: string,
  id: string,
  by: string,
): void {
  const path = resolve(ledgerDir, `${id}.json`);
  if (!existsSync(path)) return;
  const txn = JSON.parse(readFileSync(path, "utf8")) as Transaction;
  txn.undone_at = new Date().toISOString();
  txn.undone_by = by;
  writeFileSync(path, JSON.stringify(txn, null, 2) + "\n", "utf8");
}

export function readTransaction(
  ledgerDir: string,
  id: string,
): Transaction | null {
  const path = resolve(ledgerDir, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Transaction;
}

export function listTransactions(ledgerDir: string): string[] {
  if (!existsSync(ledgerDir)) return [];
  return readdirSync(ledgerDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function latestUndoableTransaction(ledgerDir: string): string | null {
  const ids = listTransactions(ledgerDir);
  for (const id of [...ids].reverse()) {
    const txn = readTransaction(ledgerDir, id);
    if (!txn) continue;
    if (txn.undone_at) continue;
    if (!txn.completed_at) continue;
    return id;
  }
  return null;
}
