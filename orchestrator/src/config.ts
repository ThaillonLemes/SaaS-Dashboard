import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export interface RepoConfig {
  name: string;
  path: string;
  worktrees_glob: string | null;
  state_file: string | null;
  next_file: string | null;
  manifests_active: string | null;
  manifests_archive: string | null;
  block_log: string;
}

export interface OrchestratorConfig {
  project: { name: string; cognition_root: string };
  repos: RepoConfig[];
  axioms: { groups: string[]; override_marker: string; source: string };
  manifest: {
    tiers: string[];
    schema_dir: string;
    templates_dir: string;
    required_frontmatter_keys: string[];
  };
  governance: {
    outputs_dir: string;
    derived_marker: string;
    overrides_file: string;
  };
  orchestrator: {
    state_dir: string;
    audit_rules_dir: string;
    hooks_dir: string;
    transaction_ledger: string;
    cache_file: string;
    lock_file: string;
  };
}

export interface LoadedConfig {
  workspaceRoot: string;
  config: OrchestratorConfig;
  configPath: string;
}

export function loadConfig(workspaceRoot: string): LoadedConfig {
  const configPath = resolve(workspaceRoot, "orchestrator.config.yaml");
  const raw = readFileSync(configPath, "utf8");
  const parsed = parseYaml(raw) as OrchestratorConfig;

  if (!parsed?.project?.name) {
    throw new Error(`governor: ${configPath} missing project.name`);
  }
  if (!Array.isArray(parsed.repos) || parsed.repos.length === 0) {
    throw new Error(`governor: ${configPath} missing repos[]`);
  }
  return { workspaceRoot, config: parsed, configPath };
}

export function repoAbsPath(
  loaded: LoadedConfig,
  repo: RepoConfig,
): string {
  return resolve(loaded.workspaceRoot, repo.path);
}

export function workspacePath(
  loaded: LoadedConfig,
  ...segments: string[]
): string {
  return resolve(loaded.workspaceRoot, ...segments);
}
