import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { parse as parseYaml } from "yaml";
import { describeRepo } from "../workspace.ts";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorResult {
  checks: Check[];
  pass: boolean;
}

export function runDoctor(loaded: LoadedConfig): DoctorResult {
  const checks: Check[] = [];
  const root = loaded.workspaceRoot;

  for (const f of ["CLAUDE.md", "PROTOCOLS.md", "STATE.md", "INDEX.md"]) {
    checks.push(filePresent(resolve(root, f), `HOT/${f}`));
  }
  checks.push(filePresent(resolve(root, "orchestrator.config.yaml"), "config"));

  const schemaDir = resolve(root, loaded.config.manifest.schema_dir);
  if (!existsSync(schemaDir)) {
    checks.push({ name: "schemas/", ok: false, detail: `missing: ${schemaDir}` });
  } else {
    for (const tier of loaded.config.manifest.tiers) {
      const p = resolve(schemaDir, `manifest-${tier}.schema.yaml`);
      const present = filePresent(p, `schema/manifest-${tier}`);
      checks.push(present);
      if (present.ok) {
        try {
          parseYaml(readFileSync(p, "utf8"));
        } catch (e) {
          checks.push({
            name: `schema/manifest-${tier} parse`,
            ok: false,
            detail: (e as Error).message,
          });
        }
      }
    }
  }

  for (const repo of loaded.config.repos) {
    const view = describeRepo(loaded, repo);
    if (!view.exists) {
      checks.push({
        name: `repo/${repo.name}`,
        ok: false,
        detail: `path missing: ${repo.path}`,
      });
      continue;
    }
    checks.push({
      name: `repo/${repo.name}`,
      ok: view.isGit,
      detail: view.isGit ? "git repo" : "not a git repo",
    });
    if (view.config.worktrees_glob) {
      const hasClaudeWt = view.worktrees.some((w) =>
        w.path.replace(/\\/g, "/").includes("/.claude/worktrees/"),
      );
      checks.push({
        name: `repo/${repo.name}/worktree`,
        ok: hasClaudeWt,
        detail: hasClaudeWt
          ? `active worktree present`
          : "no .claude/worktrees/* found (expected per config)",
      });
    }
  }

  const pass = checks.every((c) => c.ok);
  return { checks, pass };
}

function filePresent(absPath: string, label: string): Check {
  if (!existsSync(absPath)) {
    return { name: label, ok: false, detail: `missing: ${absPath}` };
  }
  const st = statSync(absPath);
  if (!st.isFile()) return { name: label, ok: false, detail: "not a file" };
  if (st.size === 0) return { name: label, ok: false, detail: "empty file" };
  return { name: label, ok: true, detail: `${st.size}B` };
}
