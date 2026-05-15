import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { LoadedConfig, RepoConfig } from "../config.ts";
import {
  describeRepo,
  listManifestFiles,
  manifestsActiveDir,
} from "../workspace.ts";
import { parseManifestFile } from "../manifest/parse.ts";

export type FileClass = "CANONICAL" | "DERIVED" | "OPERATIONAL" | "TRANSIENT" | "TEMPLATE" | "SOURCE" | "UNKNOWN";
export type Editor = "Governor" | "per-repo agent" | "Orchestrator only" | "shared";

export interface OwnershipQuery {
  path: string;
  absPath: string;
  exists: boolean;
  insideWorkspace: boolean;
  insideRepo: RepoConfig | null;
  fileClass: FileClass;
  editor: Editor;
  rationale: string[];
  claimedBy: Array<{ repo: string; blockId: string; status: string; kind: "modify" | "create" }>;
}

const DERIVED_PATTERNS = [
  /^STATE\.proposed\.md$/,
  /^governance\/dag\.md$/,
  /^governance\/overrides\.md$/,
  /^governance\/churn-[^/]+\.md$/,
  /^governance\/metrics\.md$/,
];
const OPERATIONAL_PATTERNS = [
  /^governance\/conflicts\.md$/,
  /^governance\/audit-\d{4}-\d{2}-\d{2}\.md$/,
  /^governance\/preflight-[^/]+\.md$/,
];
const TRANSIENT_PATTERNS = [
  /^\.governor\/orchestrator\/\.lock$/,
  /^\.governor\/orchestrator\/\.cache\.json$/,
];
const OPERATIONAL_LEDGER = /^\.governor\/orchestrator\/transactions\/.*\.json$/;
const TEMPLATE_PATTERNS = [/^templates\/[^/]+\.md$/];
const WORKSPACE_CANONICAL = [
  /^CLAUDE\.md$/,
  /^PROTOCOLS\.md$/,
  /^STATE\.md$/,
  /^INDEX\.md$/,
  /^WORKSPACE_MAP\.md$/,
  /^features\.md$/,
  /^orchestrator\.config\.yaml$/,
  /^governance\/overrides\.canonical-snapshot\.md$/,
  /^protocols\/[^/]+\.md$/,
  /^orchestrator\/(bin|src|schemas|audit-rules|hooks|ci)\//,
  /^orchestrator\/package\.json$/,
  /^orchestrator\/tsconfig\.json$/,
  /^\.governor\/v3\//,
  /^\.claude\/skills\//,
];
const PER_REPO_HOT = [
  /^CLAUDE\.md$/,
  /^STATE\.md$/,
  /^NEXT\.md$/,
];

export function runOwnership(
  loaded: LoadedConfig,
  target: string,
): OwnershipQuery {
  const absPath = resolve(loaded.workspaceRoot, target);
  const rel = relative(loaded.workspaceRoot, absPath).replace(/\\/g, "/");
  const exists = existsSync(absPath);
  const insideWorkspace = !rel.startsWith("..");
  const insideRepo = findRepoFor(loaded, rel);
  const rationale: string[] = [];

  const repoRel = insideRepo
    ? rel.slice(insideRepo.path.replace(/^\.\//, "").length).replace(/^\//, "")
    : null;

  let fileClass: FileClass = "UNKNOWN";
  let editor: Editor = "Governor";

  if (!insideRepo) {
    if (DERIVED_PATTERNS.some((re) => re.test(rel))) {
      fileClass = "DERIVED";
      editor = "Orchestrator only";
      rationale.push("matches a DERIVED workspace path");
    } else if (OPERATIONAL_PATTERNS.some((re) => re.test(rel))) {
      fileClass = "OPERATIONAL";
      editor = "Orchestrator only";
      rationale.push("matches an OPERATIONAL workspace path");
    } else if (TRANSIENT_PATTERNS.some((re) => re.test(rel))) {
      fileClass = "TRANSIENT";
      editor = "Orchestrator only";
      rationale.push("transient orchestrator state — safe to delete");
    } else if (OPERATIONAL_LEDGER.test(rel)) {
      fileClass = "OPERATIONAL";
      editor = "Orchestrator only";
      rationale.push("transaction ledger entry — append-only via orchestrator");
    } else if (TEMPLATE_PATTERNS.some((re) => re.test(rel))) {
      fileClass = "TEMPLATE";
      editor = "Governor";
      rationale.push("CANONICAL template — edit via Governor proposal");
    } else if (WORKSPACE_CANONICAL.some((re) => re.test(rel))) {
      fileClass = "CANONICAL";
      editor = "Governor";
      rationale.push("workspace CANONICAL — edit via Governor proposal");
    } else if (rel.startsWith(".governor/")) {
      fileClass = "OPERATIONAL";
      editor = "Governor";
      rationale.push("Governor's private workspace (logs, audits, proposals)");
    } else {
      rationale.push("path not classified by any known pattern");
    }
  } else {
    fileClass = classifyRepoPath(insideRepo, repoRel ?? "");
    editor = fileClass === "DERIVED" || fileClass === "OPERATIONAL" || fileClass === "TRANSIENT"
      ? "Orchestrator only"
      : "per-repo agent";
    rationale.push(`inside repo '${insideRepo.name}' (${insideRepo.path})`);
    if (PER_REPO_HOT.some((re) => re.test(repoRel ?? ""))) {
      rationale.push("HOT per-repo file — capped size + replace-only per PROTOCOLS.md");
    }
    if (
      insideRepo.manifests_active &&
      (repoRel ?? "").startsWith(insideRepo.manifests_active)
    ) {
      rationale.push("active block manifest — frozen at block start");
    }
    if (
      insideRepo.manifests_archive &&
      (repoRel ?? "").startsWith(insideRepo.manifests_archive)
    ) {
      rationale.push("archived manifest — frozen, immutable after archival");
    }
  }

  const claimedBy = findManifestClaims(loaded, insideRepo, repoRel ?? rel);
  for (const c of claimedBy) {
    rationale.push(`claimed by ${c.repo} ${c.blockId} (${c.status}, ${c.kind})`);
  }

  return {
    path: target,
    absPath,
    exists,
    insideWorkspace,
    insideRepo,
    fileClass,
    editor,
    rationale,
    claimedBy,
  };
}

function findRepoFor(
  loaded: LoadedConfig,
  rel: string,
): RepoConfig | null {
  for (const repo of loaded.config.repos) {
    const repoRel = repo.path.replace(/^\.\//, "").replace(/\\/g, "/").replace(/\/$/, "");
    if (rel === repoRel) return repo;
    if (rel.startsWith(repoRel + "/")) return repo;
  }
  return null;
}

function classifyRepoPath(repo: RepoConfig, repoRel: string): FileClass {
  if (PER_REPO_HOT.some((re) => re.test(repoRel))) return "CANONICAL";
  if (
    repo.manifests_active &&
    (repoRel.startsWith(repo.manifests_active + "/") || repoRel === repo.manifests_active)
  ) {
    return "CANONICAL";
  }
  if (
    repo.manifests_archive &&
    (repoRel.startsWith(repo.manifests_archive + "/") || repoRel === repo.manifests_archive)
  ) {
    return "CANONICAL";
  }
  if (repoRel.startsWith("docs/")) return "CANONICAL";
  if (
    repoRel.startsWith("src/") ||
    repoRel.startsWith("tests/") ||
    repoRel.startsWith("tools/") ||
    repoRel.startsWith("mmo_cliente/") ||
    repoRel.startsWith("Source/") ||
    repoRel.startsWith("src-tauri/") ||
    repoRel.endsWith(".toml") ||
    repoRel.endsWith(".lock")
  ) {
    return "SOURCE";
  }
  if (repoRel.startsWith("target/") || repoRel.startsWith(".claude/")) return "TRANSIENT";
  return "SOURCE";
}

function findManifestClaims(
  loaded: LoadedConfig,
  scopeRepo: RepoConfig | null,
  relPath: string,
): OwnershipQuery["claimedBy"] {
  const claims: OwnershipQuery["claimedBy"] = [];
  const repos = scopeRepo ? [scopeRepo] : loaded.config.repos;
  const needle = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  for (const repo of repos) {
    const view = describeRepo(loaded, repo);
    const dir = manifestsActiveDir(loaded, view);
    if (!dir || !existsSync(dir)) continue;
    for (const f of listManifestFiles(dir)) {
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
        for (const candidate of arr) {
          if (typeof candidate !== "string") continue;
          const normalized = candidate.replace(/\\/g, "/").replace(/^\.\//, "");
          if (normalized === needle || normalized === relPath) {
            claims.push({ repo: repo.name, blockId, status, kind });
          }
        }
      }
    }
  }
  return claims;
}

function unused(_x: unknown): void {}
unused(readFileSync);
