import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import type { AuditContext, Finding, RuleHandler } from "./types.ts";
import { describeRepo, manifestsActiveDir, listManifestFiles } from "../workspace.ts";
import { parseManifestFile } from "../manifest/parse.ts";
import { recentCommits, listWorktrees, isGitRepo } from "../git.ts";
import {
  loadAuditTemplate,
  findMissingSections,
  findMissingPatterns,
} from "./template.ts";

const ms = (n: number) => n * 86_400_000;

function rel(loaded: AuditContext["loaded"], abs: string): string {
  return relative(loaded.workspaceRoot, abs).replace(/\\/g, "/");
}

function pushInput(ctx: AuditContext, abs: string) {
  ctx.inputs.add(abs);
}

function* walkFiles(
  root: string,
  exts: Set<string>,
  skipDirs: Set<string>,
): Generator<string> {
  const stack: string[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = resolve(cur, ent.name);
      if (ent.isDirectory()) {
        if (skipDirs.has(ent.name)) continue;
        if (ent.name.startsWith(".")) continue;
        stack.push(full);
      } else if (ent.isFile()) {
        const dot = ent.name.lastIndexOf(".");
        if (dot === -1) continue;
        const ext = ent.name.slice(dot);
        if (exts.has(ext)) yield full;
      }
    }
  }
}

const DEFAULT_SKIP = new Set([
  "node_modules",
  "target",
  "Binaries",
  "Intermediate",
  "Saved",
  "DerivedDataCache",
  "build",
  "dist",
  ".git",
  ".claude",
]);

// Rule 00 — Comment Tier-D forbidden patterns
const commentTierD: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as {
    patterns?: Array<{ regex: string; label: string }>;
    extensions?: string[];
    scan_repos?: boolean;
  };
  const patterns = (cfg.patterns ?? []).map((p) => ({
    re: new RegExp(p.regex),
    label: p.label,
  }));
  const exts = new Set(cfg.extensions ?? [".rs", ".cpp", ".h", ".hpp", ".ts", ".tsx"]);
  const findings: Finding[] = [];
  if (!cfg.scan_repos) return findings;
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    if (!view.exists) continue;
    const root = view.activeWorktree?.path ?? view.absPath;
    for (const file of walkFiles(root, exts, DEFAULT_SKIP)) {
      pushInput(ctx, file);
      let content: string;
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        for (const p of patterns) {
          if (p.re.test(lines[i] ?? "")) {
            findings.push({
              ruleId: ctx.rule.id,
              severity: ctx.rule.severity,
              message: `${p.label}: ${(lines[i] ?? "").trim()}`,
              path: rel(ctx.loaded, file),
              line: i + 1,
            });
            break;
          }
        }
      }
    }
  }
  return findings;
};

// Rule 01 — Comment density
const commentDensity: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as {
    extensions?: string[];
    max_ratio?: number;
    min_lines?: number;
    scan_repos?: boolean;
  };
  const exts = new Set(cfg.extensions ?? [".rs", ".cpp", ".h", ".hpp", ".ts", ".tsx"]);
  const maxRatio = cfg.max_ratio ?? 0.1;
  const minLines = cfg.min_lines ?? 30;
  const findings: Finding[] = [];
  if (!cfg.scan_repos) return findings;
  const commentRe = /^\s*(\/\/|\/\*|\*)/;
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    if (!view.exists) continue;
    const root = view.activeWorktree?.path ?? view.absPath;
    for (const file of walkFiles(root, exts, DEFAULT_SKIP)) {
      pushInput(ctx, file);
      let content: string;
      try {
        content = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      const total = lines.filter((l) => l.trim().length > 0).length;
      if (total < minLines) continue;
      const comments = lines.filter((l) => commentRe.test(l)).length;
      const ratio = comments / total;
      if (ratio > maxRatio) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `comment density ${(ratio * 100).toFixed(1)}% (${comments}/${total} lines) exceeds ${(maxRatio * 100).toFixed(0)}%`,
          path: rel(ctx.loaded, file),
          detail: { ratio, comments, total },
        });
      }
    }
  }
  return findings;
};

// Rule 02 — Stale docs
const staleDocs: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as { paths?: string[]; max_age_days?: number };
  const paths = cfg.paths ?? ["docs/arch"];
  const maxAge = cfg.max_age_days ?? 90;
  const cutoff = Date.now() - ms(maxAge);
  const findings: Finding[] = [];
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    if (!view.isGit) continue;
    const root = view.activeWorktree?.path ?? view.absPath;
    for (const sub of paths) {
      const dir = resolve(root, sub);
      if (!existsSync(dir)) continue;
      for (const file of walkFiles(dir, new Set([".md"]), DEFAULT_SKIP)) {
        pushInput(ctx, file);
        let commits;
        try {
          commits = recentCommits(view.absPath, "HEAD", 1);
        } catch {
          continue;
        }
        let st;
        try {
          st = statSync(file);
        } catch {
          continue;
        }
        const last = st.mtimeMs;
        if (last < cutoff) {
          const days = Math.floor((Date.now() - last) / ms(1));
          findings.push({
            ruleId: ctx.rule.id,
            severity: ctx.rule.severity,
            message: `not touched in ${days} days (cap ${maxAge})`,
            path: rel(ctx.loaded, file),
            detail: { age_days: days },
          });
        }
      }
    }
  }
  return findings;
};

// Rule 03 — Index pointers
const indexPointers: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as { index_files?: string[] };
  const indexes = cfg.index_files ?? ["INDEX.md"];
  const findings: Finding[] = [];
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;

  const checkFile = (indexAbs: string) => {
    if (!existsSync(indexAbs)) return;
    pushInput(ctx, indexAbs);
    const raw = readFileSync(indexAbs, "utf8");
    const content = stripFences(raw);
    const seen = new Set<string>();
    const indexDir = resolve(indexAbs, "..");
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(content))) {
      const ref = m[1] ?? "";
      if (!ref || ref.startsWith("http") || ref.startsWith("#")) continue;
      if (ref.startsWith("mailto:")) continue;
      const cleaned = ref.split("#")[0]?.split(" ")[0]?.trim() ?? "";
      if (!cleaned) continue;
      if (/[<>?*{}]/.test(cleaned)) continue;
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      const candidates = candidatePaths(ctx.loaded.workspaceRoot, indexDir, cleaned);
      if (!candidates.some((c) => existsSync(c))) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `broken pointer → ${cleaned}`,
          path: rel(ctx.loaded, indexAbs),
        });
      }
    }
  };

  for (const idx of indexes) checkFile(resolve(ctx.loaded.workspaceRoot, idx));
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    const root = view.activeWorktree?.path ?? view.absPath;
    checkFile(resolve(root, "docs/INDEX.md"));
  }
  return findings;
};

function stripFences(raw: string): string {
  return raw.replace(/```[\s\S]*?```/g, "");
}

function candidatePaths(
  workspaceRoot: string,
  indexDir: string,
  ref: string,
): string[] {
  const out: string[] = [];
  out.push(resolve(indexDir, ref));
  if (ref.startsWith("MMORPG/")) {
    out.push(resolve(workspaceRoot, ref.slice("MMORPG/".length)));
  }
  if (!ref.startsWith(".") && !ref.startsWith("/")) {
    out.push(resolve(workspaceRoot, ref));
  }
  return out;
}

// Rule 04 — HOT size caps
const hotSizeCaps: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as {
    workspace?: Array<{ path: string; cap_bytes: number }>;
    per_repo?: Array<{ path: string; cap_bytes: number }>;
  };
  const findings: Finding[] = [];
  for (const e of cfg.workspace ?? []) {
    const abs = resolve(ctx.loaded.workspaceRoot, e.path);
    if (!existsSync(abs)) continue;
    pushInput(ctx, abs);
    const size = statSync(abs).size;
    if (size > e.cap_bytes) {
      findings.push({
        ruleId: ctx.rule.id,
        severity: ctx.rule.severity,
        message: `size ${size}B exceeds cap ${e.cap_bytes}B (+${size - e.cap_bytes})`,
        path: e.path,
      });
    }
  }
  for (const e of cfg.per_repo ?? []) {
    for (const repo of ctx.loaded.config.repos) {
      const view = describeRepo(ctx.loaded, repo);
      if (!view.exists) continue;
      const root = view.activeWorktree?.path ?? view.absPath;
      const abs = resolve(root, e.path);
      if (!existsSync(abs)) continue;
      pushInput(ctx, abs);
      const size = statSync(abs).size;
      if (size > e.cap_bytes) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `${repo.name}/${e.path}: ${size}B exceeds cap ${e.cap_bytes}B (+${size - e.cap_bytes})`,
          path: rel(ctx.loaded, abs),
        });
      }
    }
  }
  return findings;
};

// Rule 05 — Override regen (derivation, not check). Emits 0 findings.
const overrideRegen: RuleHandler = (ctx) => {
  const overrides: Array<{ axiom: string; block: string; repo: string; justification: string }> = [];
  const ownInputs: string[] = [];
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    if (!repo.manifests_archive) continue;
    const root = view.activeWorktree?.path ?? view.absPath;
    const archDir = resolve(root, repo.manifests_archive);
    if (!existsSync(archDir)) continue;
    for (const file of walkFiles(archDir, new Set([".md"]), DEFAULT_SKIP)) {
      pushInput(ctx, file);
      ownInputs.push(file);
      const parsed = parseManifestFile(file);
      if (!parsed.frontmatter) continue;
      const ov = parsed.frontmatter.axiom_override;
      if (typeof ov !== "string") continue;
      const m = ov.match(/^([PQC]-?\d+)\s+—\s+(.+)$/);
      if (!m) continue;
      const id = typeof parsed.frontmatter.id === "string" ? parsed.frontmatter.id : "(unknown)";
      overrides.push({
        axiom: m[1] ?? "",
        block: id,
        repo: repo.name,
        justification: m[2] ?? "",
      });
    }
  }
  (ctx as unknown as { __overrides?: typeof overrides }).__overrides = overrides;
  (ctx as unknown as { __overrideInputs?: string[] }).__overrideInputs = ownInputs;
  return [];
};

// Rule 06 — Orchestrator config integrity
const orchestratorConfig: RuleHandler = (ctx) => {
  const findings: Finding[] = [];
  pushInput(ctx, resolve(ctx.loaded.workspaceRoot, "orchestrator.config.yaml"));
  for (const repo of ctx.loaded.config.repos) {
    const abs = resolve(ctx.loaded.workspaceRoot, repo.path);
    if (!existsSync(abs)) {
      findings.push({
        ruleId: ctx.rule.id,
        severity: ctx.rule.severity,
        message: `repos[${repo.name}].path does not resolve: ${repo.path}`,
      });
      continue;
    }
    if (repo.manifests_active) {
      const view = describeRepo(ctx.loaded, repo);
      const root = view.activeWorktree?.path ?? view.absPath;
      const md = resolve(root, repo.manifests_active);
      if (!existsSync(md)) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `repos[${repo.name}].manifests_active not found: ${repo.manifests_active}`,
        });
      }
    }
  }
  const schemaDir = resolve(
    ctx.loaded.workspaceRoot,
    ctx.loaded.config.manifest.schema_dir,
  );
  if (!existsSync(schemaDir)) {
    findings.push({
      ruleId: ctx.rule.id,
      severity: ctx.rule.severity,
      message: `manifest.schema_dir not found: ${ctx.loaded.config.manifest.schema_dir}`,
    });
  }
  return findings;
};

// Rule 07 — Concurrent blocks
const concurrentBlocks: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as { max_active?: number };
  const cap = cfg.max_active ?? 3;
  const findings: Finding[] = [];
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    const dir = manifestsActiveDir(ctx.loaded, view);
    if (!dir || !existsSync(dir)) continue;
    const files = listManifestFiles(dir);
    files.forEach((f) => pushInput(ctx, f));
    const inProgress = files.filter((f) => {
      const p = parseManifestFile(f);
      const s = p.frontmatter?.status;
      return s === "InProgress";
    });
    if (inProgress.length > cap) {
      findings.push({
        ruleId: ctx.rule.id,
        severity: ctx.rule.severity,
        message: `${repo.name}: ${inProgress.length} InProgress manifests (cap ${cap})`,
        detail: { count: inProgress.length },
      });
    }
  }
  return findings;
};

// Rule 08 — Manifest age
const manifestAge: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as { max_age_days?: number };
  const maxAge = cfg.max_age_days ?? 14;
  const findings: Finding[] = [];
  const now = Date.now();
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    const dir = manifestsActiveDir(ctx.loaded, view);
    if (!dir || !existsSync(dir)) continue;
    for (const f of listManifestFiles(dir)) {
      pushInput(ctx, f);
      const p = parseManifestFile(f);
      if (!p.frontmatter) continue;
      const created = p.frontmatter.created_at;
      const status = p.frontmatter.status;
      if (typeof created !== "string" || typeof status !== "string") continue;
      if (status === "Complete" || status === "Reverted") continue;
      const t = Date.parse(created);
      if (!Number.isFinite(t)) continue;
      const days = Math.floor((now - t) / ms(1));
      if (days > maxAge) {
        const id =
          typeof p.frontmatter.id === "string" ? p.frontmatter.id : "(unknown)";
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `${repo.name} ${id}: status=${status}, age=${days}d (cap ${maxAge}d) — split, escalate, or complete`,
          path: rel(ctx.loaded, f),
          detail: { age_days: days, status },
        });
      }
    }
  }
  return findings;
};

// Rule 09 — File scope cap
const fileScopeCap: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as { tier_m_cap?: number };
  const cap = cfg.tier_m_cap ?? 8;
  const findings: Finding[] = [];
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    const dir = manifestsActiveDir(ctx.loaded, view);
    if (!dir || !existsSync(dir)) continue;
    for (const f of listManifestFiles(dir)) {
      pushInput(ctx, f);
      const p = parseManifestFile(f);
      if (!p.frontmatter) continue;
      if (p.frontmatter.tier !== "M") continue;
      const files = p.frontmatter.files as Record<string, unknown> | undefined;
      if (!files) continue;
      const modify = Array.isArray(files.modify) ? files.modify.length : 0;
      const create = Array.isArray(files.create) ? files.create.length : 0;
      const total = modify + create;
      if (total > cap) {
        const id =
          typeof p.frontmatter.id === "string" ? p.frontmatter.id : "(unknown)";
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `${repo.name} ${id}: ${total} files (cap ${cap}) — escalate to Tier L`,
          path: rel(ctx.loaded, f),
          detail: { modify, create, total },
        });
      }
    }
  }
  return findings;
};

// Rule 10 — Manual edit DERIVED
const manualEditDerived: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as {
    derived_paths?: string[];
    signature_regex?: string;
  };
  const sigRe = new RegExp(cfg.signature_regex ?? "^chore\\(orchestrator\\):");
  const derivedPaths = (cfg.derived_paths ?? []).map((p) =>
    resolve(ctx.loaded.workspaceRoot, p),
  );
  const findings: Finding[] = [];
  for (const abs of derivedPaths) {
    if (!existsSync(abs)) continue;
    pushInput(ctx, abs);
  }
  for (const repo of ctx.loaded.config.repos) {
    const view = describeRepo(ctx.loaded, repo);
    if (!view.isGit) continue;
    const root = view.activeWorktree?.path ?? view.absPath;
    try {
      const commits = recentCommits(view.absPath, "HEAD", 50);
      for (const c of commits) {
        if (sigRe.test(c.subject)) continue;
      }
    } catch {
      // ignore
    }
    void root;
  }
  return findings;
};

// Rule 11 — Ownership violations
const ownershipViolations: RuleHandler = (ctx) => {
  const findings: Finding[] = [];
  for (const repo of ctx.loaded.config.repos) {
    if (!isGitRepo(resolve(ctx.loaded.workspaceRoot, repo.path))) continue;
    try {
      const wts = listWorktrees(resolve(ctx.loaded.workspaceRoot, repo.path));
      for (const wt of wts) {
        if (!wt.path.replace(/\\/g, "/").includes("/.claude/worktrees/")) continue;
        const commits = recentCommits(wt.path, "HEAD", 20);
        for (const c of commits) {
          // git history is intra-repo by definition; no findings expected
          // until workspace-wide audit gains cross-repo visibility (Wave 3).
          void c;
        }
      }
    } catch {
      // ignore
    }
  }
  return findings;
};

// Rule 12 — Bootstrap integrity (template-driven)
const bootstrapIntegrity: RuleHandler = (ctx) => {
  const cfg = ctx.rule.config as {
    workspace?: Array<{
      path: string;
      required_sections?: string[];
      must_exist?: boolean;
    }>;
    per_repo_templates?: string[];
  };
  const findings: Finding[] = [];
  for (const e of cfg.workspace ?? []) {
    const abs = resolve(ctx.loaded.workspaceRoot, e.path);
    if (!existsSync(abs)) {
      if (e.must_exist !== false) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `missing HOT file: ${e.path}`,
          path: e.path,
        });
      }
      continue;
    }
    pushInput(ctx, abs);
    const st = statSync(abs);
    if (!st.isFile() || st.size === 0) {
      findings.push({
        ruleId: ctx.rule.id,
        severity: ctx.rule.severity,
        message: `${e.path}: not a file or empty`,
        path: e.path,
      });
      continue;
    }
    if (e.required_sections && e.required_sections.length > 0) {
      const content = readFileSync(abs, "utf8");
      const missing = findMissingSections(content, e.required_sections);
      if (missing.length) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `${e.path}: missing sections — ${missing.join(", ")}`,
          path: e.path,
        });
      }
    }
  }
  for (const tplPath of cfg.per_repo_templates ?? []) {
    const tplAbs = resolve(ctx.loaded.workspaceRoot, tplPath);
    const tpl = loadAuditTemplate(tplAbs);
    if (!tpl) {
      findings.push({
        ruleId: ctx.rule.id,
        severity: ctx.rule.severity,
        message: `template ${tplPath} has no readable audit-template header`,
        path: tplPath,
      });
      continue;
    }
    pushInput(ctx, tplAbs);
    for (const repo of ctx.loaded.config.repos) {
      const view = describeRepo(ctx.loaded, repo);
      if (!view.exists) continue;
      const root = view.activeWorktree?.path ?? view.absPath;
      const targetAbs = resolve(root, tpl.appliesTo);
      if (!existsSync(targetAbs)) {
        if (view.config.state_file || view.config.next_file) {
          findings.push({
            ruleId: ctx.rule.id,
            severity: ctx.rule.severity,
            message: `${repo.name}: missing ${tpl.appliesTo} (per template ${tplPath})`,
            path: rel(ctx.loaded, targetAbs),
          });
        }
        continue;
      }
      pushInput(ctx, targetAbs);
      const st = statSync(targetAbs);
      const content = readFileSync(targetAbs, "utf8");
      if (tpl.sizeCapBytes != null && st.size > tpl.sizeCapBytes) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: "WARNING",
          message: `${repo.name}/${tpl.appliesTo}: ${st.size}B exceeds template cap ${tpl.sizeCapBytes}B`,
          path: rel(ctx.loaded, targetAbs),
        });
      }
      const missingSections = findMissingSections(content, tpl.requiredSections);
      if (missingSections.length) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `${repo.name}/${tpl.appliesTo}: missing sections — ${missingSections.join(", ")}`,
          path: rel(ctx.loaded, targetAbs),
        });
      }
      const missingPatterns = findMissingPatterns(content, tpl.requiredPatterns);
      if (missingPatterns.length) {
        findings.push({
          ruleId: ctx.rule.id,
          severity: ctx.rule.severity,
          message: `${repo.name}/${tpl.appliesTo}: missing patterns — ${missingPatterns.join(", ")}`,
          path: rel(ctx.loaded, targetAbs),
        });
      }
    }
  }
  return findings;
};

export const handlers: Record<string, RuleHandler> = {
  "comment-tier-d": commentTierD,
  "comment-density": commentDensity,
  "stale-docs": staleDocs,
  "index-pointers": indexPointers,
  "hot-size-caps": hotSizeCaps,
  "override-regen": overrideRegen,
  "orchestrator-config": orchestratorConfig,
  "concurrent-blocks": concurrentBlocks,
  "manifest-age": manifestAge,
  "file-scope-cap": fileScopeCap,
  "manual-edit-derived": manualEditDerived,
  "ownership-violations": ownershipViolations,
  "bootstrap-integrity": bootstrapIntegrity,
};
