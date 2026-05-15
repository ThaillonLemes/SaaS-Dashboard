import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { acquireLock } from "../lock.ts";
import { buildSources, formatFooter } from "../footer.ts";
import { parseManifestFile } from "../manifest/parse.ts";
import {
  describeRepo,
  listManifestFiles,
  manifestsActiveDir,
} from "../workspace.ts";

interface ScopeClaim {
  repo: string;
  blockId: string;
  status: string;
  kind: "modify" | "create";
  file: string;
}

export async function runConflicts(loaded: LoadedConfig): Promise<string> {
  const lockPath = resolve(
    loaded.workspaceRoot,
    loaded.config.orchestrator.lock_file,
  );
  const lock = await acquireLock(lockPath);
  try {
    const claims: ScopeClaim[] = [];
    const sourcePaths: string[] = [];

    for (const repo of loaded.config.repos) {
      const view = describeRepo(loaded, repo);
      const dir = manifestsActiveDir(loaded, view);
      if (!dir || !existsSync(dir)) continue;
      for (const f of listManifestFiles(dir)) {
        sourcePaths.push(f);
        const parsed = parseManifestFile(f);
        if (!parsed.frontmatter) continue;
        const fm = parsed.frontmatter;
        const status = typeof fm.status === "string" ? fm.status : "";
        if (status !== "Pending" && status !== "InProgress") continue;
        const blockId = typeof fm.id === "string" ? fm.id : "(unknown)";
        const files = fm.files as Record<string, unknown> | undefined;
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
              file: normalize(file),
            });
          }
        }
      }
    }

    const byFile = new Map<string, ScopeClaim[]>();
    for (const c of claims) {
      const key = `${c.repo}:${c.file}`;
      const arr = byFile.get(key) ?? [];
      arr.push(c);
      byFile.set(key, arr);
    }
    const conflicts: { key: string; claims: ScopeClaim[] }[] = [];
    for (const [key, arr] of byFile) {
      if (arr.length > 1) conflicts.push({ key, claims: arr });
    }
    conflicts.sort((a, b) => a.key.localeCompare(b.key));

    const lines: string[] = [];
    lines.push("# Active block file-scope conflicts");
    lines.push("");
    lines.push("_OPERATIONAL — regenerate via `governor conflicts`._");
    lines.push("");
    lines.push(
      `Scanned ${claims.length} file claims across ${loaded.config.repos.length} repos.`,
    );
    lines.push("");
    if (conflicts.length === 0) {
      lines.push("**No conflicts detected.**");
    } else {
      lines.push(`**${conflicts.length} conflicting file(s).**`);
      lines.push("");
      for (const c of conflicts) {
        const [repo, file] = c.key.split(":", 2);
        lines.push(`## ${repo}: \`${file}\``);
        lines.push("");
        for (const claim of c.claims) {
          lines.push(`- ${claim.blockId} (${claim.status}, ${claim.kind})`);
        }
        lines.push("");
      }
    }

    const outDir = resolve(
      loaded.workspaceRoot,
      loaded.config.governance.outputs_dir,
    );
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "conflicts.md");
    const footer = formatFooter({
      generator: "conflicts",
      generatedAt: new Date().toISOString(),
      sources: buildSources(loaded.workspaceRoot, sourcePaths),
    });
    writeFileSync(outPath, lines.join("\n") + "\n" + footer, "utf8");
    return outPath;
  } finally {
    lock.release();
  }
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}
