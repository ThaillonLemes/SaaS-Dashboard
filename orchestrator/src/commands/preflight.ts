import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { parseManifestFile, parseManifestText } from "../manifest/parse.ts";
import { getValidator } from "../manifest/validate.ts";
import {
  describeRepo,
  listManifestFiles,
  manifestsActiveDir,
} from "../workspace.ts";
import { buildSources, formatFooter } from "../footer.ts";

export interface PreflightFinding {
  severity: "ERROR" | "WARNING";
  category: "schema" | "dependencies" | "scope" | "tier" | "metadata";
  message: string;
}

export interface PreflightResult {
  manifestPath: string;
  blockId: string | null;
  tier: string | null;
  status: string | null;
  ok: boolean;
  findings: PreflightFinding[];
  reportPath: string | null;
}

export function runPreflight(
  loaded: LoadedConfig,
  target: string,
): PreflightResult {
  const absTarget = resolve(loaded.workspaceRoot, target);
  if (!existsSync(absTarget)) {
    return {
      manifestPath: absTarget,
      blockId: null,
      tier: null,
      status: null,
      ok: false,
      findings: [
        {
          severity: "ERROR",
          category: "metadata",
          message: `manifest not found at ${target}`,
        },
      ],
      reportPath: null,
    };
  }

  const findings: PreflightFinding[] = [];
  const parsed = parseManifestFile(absTarget);

  if (!parsed.hasFrontmatter) {
    findings.push({
      severity: "ERROR",
      category: "metadata",
      message: "manifest has no YAML frontmatter block",
    });
    return finalize(loaded, absTarget, null, null, null, findings);
  }
  if (parsed.parseError || !parsed.frontmatter) {
    findings.push({
      severity: "ERROR",
      category: "metadata",
      message: `frontmatter parse error: ${parsed.parseError ?? "unknown"}`,
    });
    return finalize(loaded, absTarget, null, null, null, findings);
  }

  const fm = parsed.frontmatter;
  const blockId = typeof fm.id === "string" ? fm.id : null;
  const tier = typeof fm.tier === "string" ? fm.tier : null;
  const status = typeof fm.status === "string" ? fm.status : null;

  const schemaDir = resolve(
    loaded.workspaceRoot,
    loaded.config.manifest.schema_dir,
  );
  const validator = getValidator(schemaDir);
  const validation = validator.validate(fm);
  if (!validation.valid) {
    for (const e of validation.errors) {
      findings.push({ severity: "ERROR", category: "schema", message: e });
    }
  }

  if (tier === "M" || tier === "L") {
    const files = fm.files as Record<string, unknown> | undefined;
    const modify = Array.isArray(files?.modify) ? (files!.modify as unknown[]).length : 0;
    const create = Array.isArray(files?.create) ? (files!.create as unknown[]).length : 0;
    if (tier === "M" && modify + create > 8) {
      findings.push({
        severity: "ERROR",
        category: "tier",
        message: `Tier M cap is 8 files; this manifest declares ${modify + create} (modify=${modify}, create=${create}) — escalate to Tier L`,
      });
    }
  }

  const deps = Array.isArray(fm.dependencies) ? (fm.dependencies as string[]) : [];
  const knownBlockIds = collectKnownBlockIds(loaded);
  for (const dep of deps) {
    const bare = dep.replace(/^mmo-[a-z]+ /, "");
    if (!knownBlockIds.has(bare)) {
      findings.push({
        severity: "WARNING",
        category: "dependencies",
        message: `dependency '${dep}' not found in any active or archived manifest`,
      });
    }
  }

  const claims = collectScopeClaims(loaded, absTarget);
  const myFiles = collectFiles(fm);
  for (const f of myFiles) {
    const conflicts = claims.filter((c) => c.file === f.path && c.repo);
    for (const c of conflicts) {
      findings.push({
        severity: "ERROR",
        category: "scope",
        message: `file scope conflict: ${f.kind} '${f.path}' is also claimed by ${c.blockId} (${c.status}, ${c.kind})`,
      });
    }
  }

  return finalize(loaded, absTarget, blockId, tier, status, findings);
}

function finalize(
  loaded: LoadedConfig,
  absTarget: string,
  blockId: string | null,
  tier: string | null,
  status: string | null,
  findings: PreflightFinding[],
): PreflightResult {
  const ok = !findings.some((f) => f.severity === "ERROR");
  const reportPath = writeReport(loaded, absTarget, blockId, tier, status, findings, ok);
  return {
    manifestPath: absTarget,
    blockId,
    tier,
    status,
    ok,
    findings,
    reportPath,
  };
}

function writeReport(
  loaded: LoadedConfig,
  absTarget: string,
  blockId: string | null,
  tier: string | null,
  status: string | null,
  findings: PreflightFinding[],
  ok: boolean,
): string {
  const outDir = resolve(
    loaded.workspaceRoot,
    loaded.config.governance.outputs_dir,
  );
  mkdirSync(outDir, { recursive: true });
  const slug = blockId ?? "unknown";
  const outPath = resolve(outDir, `preflight-${slug}.md`);
  const lines: string[] = [];
  lines.push(`# Preflight — ${blockId ?? "(no id)"}`);
  lines.push("");
  lines.push("_OPERATIONAL — regenerate via `governor preflight <manifest>`._");
  lines.push("");
  lines.push(`- **Manifest:** \`${relative(loaded.workspaceRoot, absTarget).replace(/\\/g, "/")}\``);
  lines.push(`- **Tier:** ${tier ?? "—"}`);
  lines.push(`- **Status:** ${status ?? "—"}`);
  lines.push(`- **Verdict:** ${ok ? "READY" : "BLOCKED"}`);
  lines.push("");

  const errors = findings.filter((f) => f.severity === "ERROR");
  const warnings = findings.filter((f) => f.severity === "WARNING");
  if (errors.length) {
    lines.push("## Errors");
    lines.push("");
    for (const f of errors) lines.push(`- **[${f.category}]** ${f.message}`);
    lines.push("");
  }
  if (warnings.length) {
    lines.push("## Warnings");
    lines.push("");
    for (const f of warnings) lines.push(`- **[${f.category}]** ${f.message}`);
    lines.push("");
  }
  if (!errors.length && !warnings.length) {
    lines.push("_No findings. Block is cleared to start._");
    lines.push("");
  }
  const footer = formatFooter({
    generator: "preflight",
    generatedAt: new Date().toISOString(),
    sources: buildSources(loaded.workspaceRoot, [absTarget]),
  });
  writeFileSync(outPath, lines.join("\n") + "\n" + footer, "utf8");
  return outPath;
}

function collectKnownBlockIds(loaded: LoadedConfig): Set<string> {
  const ids = new Set<string>();
  for (const repo of loaded.config.repos) {
    const view = describeRepo(loaded, repo);
    if (!view.exists) continue;
    const root = view.activeWorktree?.path ?? view.absPath;
    const dirs: string[] = [];
    if (repo.manifests_active) dirs.push(resolve(root, repo.manifests_active));
    if (repo.manifests_archive) dirs.push(resolve(root, repo.manifests_archive));
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      for (const f of listManifestFiles(dir)) {
        const p = parseManifestFile(f);
        if (typeof p.frontmatter?.id === "string") ids.add(p.frontmatter.id);
      }
    }
  }
  return ids;
}

interface ScopeClaim {
  repo: string;
  blockId: string;
  status: string;
  kind: "modify" | "create";
  file: string;
  manifestPath: string;
}

function collectScopeClaims(loaded: LoadedConfig, exclude: string): ScopeClaim[] {
  const claims: ScopeClaim[] = [];
  for (const repo of loaded.config.repos) {
    const view = describeRepo(loaded, repo);
    const dir = manifestsActiveDir(loaded, view);
    if (!dir || !existsSync(dir)) continue;
    for (const f of listManifestFiles(dir)) {
      if (resolve(f) === resolve(exclude)) continue;
      const p = parseManifestFile(f);
      if (!p.frontmatter) continue;
      const status = typeof p.frontmatter.status === "string" ? p.frontmatter.status : "";
      if (status !== "Pending" && status !== "InProgress") continue;
      const blockId = typeof p.frontmatter.id === "string" ? p.frontmatter.id : "(unknown)";
      const files = p.frontmatter.files as Record<string, unknown> | undefined;
      if (!files) continue;
      for (const kind of ["modify", "create"] as const) {
        const arr = files[kind];
        if (!Array.isArray(arr)) continue;
        for (const file of arr) {
          if (typeof file !== "string") continue;
          claims.push({
            repo: repo.name,
            blockId,
            status,
            kind,
            file: file.replace(/\\/g, "/").replace(/^\.\//, ""),
            manifestPath: f,
          });
        }
      }
    }
  }
  return claims;
}

function collectFiles(
  fm: Record<string, unknown>,
): Array<{ kind: "modify" | "create"; path: string }> {
  const out: Array<{ kind: "modify" | "create"; path: string }> = [];
  const files = fm.files as Record<string, unknown> | undefined;
  if (!files) return out;
  for (const kind of ["modify", "create"] as const) {
    const arr = files[kind];
    if (!Array.isArray(arr)) continue;
    for (const f of arr) {
      if (typeof f === "string") {
        out.push({ kind, path: f.replace(/\\/g, "/").replace(/^\.\//, "") });
      }
    }
  }
  return out;
}

void parseManifestText;
void dirname;
