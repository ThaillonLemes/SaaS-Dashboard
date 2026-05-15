import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import { renderAuditReport, runAudit, summarize, type AuditResult } from "../audit/engine.ts";

export async function runAuditCommand(
  loaded: LoadedConfig,
  options: { only?: string[] } = {},
): Promise<{ path: string; result: AuditResult }> {
  const lockPath = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.lock_file,
  );
  const lock = await acquireLock(lockPath);
  try {
    const cachePath = resolve(
      loaded.workspaceRoot,
      loaded.config.orchestrator.cache_file,
    );
    let scanCache = null;
    if (existsSync(cachePath)) {
      try {
        scanCache = JSON.parse(readFileSync(cachePath, "utf8"));
      } catch {
        scanCache = null;
      }
    }

    const result = await runAudit(loaded, { only: options.only, scanCache });
    const content = renderAuditReport(loaded, result);
    const outDir = resolve(
      loaded.workspaceRoot,
      loaded.config.governance.outputs_dir,
    );
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, `audit-${result.date}.md`);
    writeFileSync(outPath, content, "utf8");
    return { path: outPath, result };
  } finally {
    lock.release();
  }
}

export { summarize };
