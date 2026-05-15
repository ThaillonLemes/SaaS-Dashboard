import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import { buildSources, formatFooter } from "../footer.ts";
import { parseManifestFile, type ParsedManifest } from "../manifest/parse.ts";
import { getValidator } from "../manifest/validate.ts";
import {
  describeRepo,
  listManifestFiles,
  manifestsActiveDir,
} from "../workspace.ts";

interface NextEntry {
  repo: string;
  manifest: ParsedManifest;
  id: string;
  tier: string;
  status: string;
  dependencies: string[];
  validationOk: boolean;
  validationErrors: string[];
}

export async function runNext(loaded: LoadedConfig): Promise<string> {
  const lockPath = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.lock_file,
  );
  const lock = await acquireLock(lockPath);
  try {
    const schemaDir = resolve(
      loaded.workspaceRoot,
      loaded.config.manifest.schema_dir,
    );
    const validator = getValidator(schemaDir);

    const entries: NextEntry[] = [];
    const legacy: { repo: string; path: string; reason: string }[] = [];
    const sourcePaths: string[] = [];

    for (const repo of loaded.config.repos) {
      const view = describeRepo(loaded, repo);
      const dir = manifestsActiveDir(loaded, view);
      if (!dir || !existsSync(dir)) continue;
      const files = listManifestFiles(dir);
      for (const f of files) {
        sourcePaths.push(f);
        const parsed = parseManifestFile(f);
        if (!parsed.hasFrontmatter) {
          legacy.push({
            repo: repo.name,
            path: rel(loaded, f),
            reason: "no YAML frontmatter (pre-Wave-0 manifest)",
          });
          continue;
        }
        if (parsed.parseError || !parsed.frontmatter) {
          legacy.push({
            repo: repo.name,
            path: rel(loaded, f),
            reason: parsed.parseError ?? "frontmatter unparseable",
          });
          continue;
        }
        const fm = parsed.frontmatter;
        const validation = validator.validate(fm);
        entries.push({
          repo: repo.name,
          manifest: parsed,
          id: stringField(fm, "id") ?? "(missing id)",
          tier: stringField(fm, "tier") ?? "?",
          status: stringField(fm, "status") ?? "?",
          dependencies: arrayField(fm, "dependencies"),
          validationOk: validation.valid,
          validationErrors: validation.errors,
        });
      }
    }

    const lines: string[] = [];
    lines.push("# Block DAG (pending + in-progress)");
    lines.push("");
    lines.push("_DERIVED — regenerate via `governor next`._");
    lines.push("");
    lines.push(
      `Active manifests parsed: ${entries.length}. Legacy (no frontmatter): ${legacy.length}.`,
    );
    lines.push("");

    const active = entries.filter(
      (e) => e.status === "Pending" || e.status === "InProgress",
    );
    const order = topoSort(active);

    lines.push("## Topological order (Pending + InProgress)");
    lines.push("");
    if (order.length === 0) {
      lines.push("_no pending blocks_");
    } else {
      lines.push("| # | Repo | Block | Tier | Status | Deps | Schema |");
      lines.push("|---|------|-------|------|--------|------|--------|");
      order.forEach((e, i) => {
        const deps = e.dependencies.length ? e.dependencies.join(", ") : "—";
        const schema = e.validationOk ? "ok" : `INVALID (${e.validationErrors.length})`;
        lines.push(
          `| ${i + 1} | ${e.repo} | ${e.id} | ${e.tier} | ${e.status} | ${deps} | ${schema} |`,
        );
      });
    }
    lines.push("");

    const completed = entries.filter(
      (e) => e.status === "Complete" || e.status === "Reverted",
    );
    if (completed.length > 0) {
      lines.push("## Completed / reverted (still in active/)");
      lines.push("");
      for (const e of completed) {
        lines.push(`- ${e.repo} ${e.id} — ${e.status}`);
      }
      lines.push("");
    }

    const invalid = entries.filter((e) => !e.validationOk);
    if (invalid.length > 0) {
      lines.push("## Schema validation failures");
      lines.push("");
      for (const e of invalid) {
        lines.push(`### ${e.repo} ${e.id} (tier ${e.tier})`);
        for (const err of e.validationErrors) lines.push(`- ${err}`);
        lines.push("");
      }
    }

    if (legacy.length > 0) {
      lines.push("## Legacy manifests (skipped)");
      lines.push("");
      lines.push("Migration to YAML frontmatter is opt-in (per Wave 0 design).");
      lines.push("");
      for (const l of legacy) {
        lines.push(`- ${l.repo} \`${l.path}\` — ${l.reason}`);
      }
      lines.push("");
    }

    const outDir = resolve(
      loaded.workspaceRoot,
      loaded.config.governance.outputs_dir,
    );
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "dag.md");
    const footer = formatFooter({
      generator: "next",
      generatedAt: new Date().toISOString(),
      sources: buildSources(loaded.workspaceRoot, sourcePaths),
    });
    writeFileSync(outPath, lines.join("\n") + "\n" + footer, "utf8");
    return outPath;
  } finally {
    lock.release();
  }
}

function stringField(
  fm: Record<string, unknown>,
  key: string,
): string | null {
  const v = fm[key];
  return typeof v === "string" ? v : null;
}

function arrayField(fm: Record<string, unknown>, key: string): string[] {
  const v = fm[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function topoSort(entries: NextEntry[]): NextEntry[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const visited = new Set<string>();
  const result: NextEntry[] = [];
  function visit(e: NextEntry, stack: Set<string>) {
    if (visited.has(e.id)) return;
    if (stack.has(e.id)) return;
    stack.add(e.id);
    for (const dep of e.dependencies) {
      const bare = dep.replace(/^mmo-[a-z]+ /, "");
      const target = byId.get(bare);
      if (target) visit(target, stack);
    }
    stack.delete(e.id);
    visited.add(e.id);
    result.push(e);
  }
  for (const e of entries) visit(e, new Set());
  return result;
}

function rel(loaded: LoadedConfig, abs: string): string {
  return abs.replace(loaded.workspaceRoot, "").replace(/\\/g, "/").replace(/^\//, "");
}
