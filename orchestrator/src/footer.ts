import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

export interface FooterSource {
  path: string;
  sha256: string;
}

export interface Footer {
  generator: string;
  generatedAt: string;
  sources: FooterSource[];
}

const BEGIN = "<!-- generator: governor";
const SOURCES_BEGIN = "<!-- sources:";
const SOURCES_END = "<!-- end:sources -->";

export function hashFile(absPath: string): string {
  const buf = readFileSync(absPath);
  return createHash("sha256").update(buf).digest("hex");
}

export function buildSources(
  workspaceRoot: string,
  absPaths: string[],
): FooterSource[] {
  return absPaths.map((p) => ({
    path: relative(workspaceRoot, p).replace(/\\/g, "/"),
    sha256: hashFile(p),
  }));
}

export function formatFooter(footer: Footer): string {
  const lines = [
    "",
    `${BEGIN} ${footer.generator} @ ${footer.generatedAt} -->`,
    SOURCES_BEGIN,
  ];
  for (const s of footer.sources) {
    lines.push(`<!--   ${s.path}  ${s.sha256} -->`);
  }
  lines.push(SOURCES_END);
  return lines.join("\n") + "\n";
}

export function parseFooter(content: string): Footer | null {
  const lines = content.split(/\r?\n/);
  let headerIdx = -1;
  let sourcesStart = -1;
  let sourcesEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (headerIdx === -1 && line.startsWith(BEGIN)) headerIdx = i;
    else if (line.startsWith(SOURCES_BEGIN)) sourcesStart = i;
    else if (line.startsWith(SOURCES_END)) {
      sourcesEnd = i;
      break;
    }
  }
  if (headerIdx === -1 || sourcesStart === -1 || sourcesEnd === -1) return null;
  const header = lines[headerIdx] ?? "";
  const m = header.match(
    /^<!-- generator: governor (.+) @ (.+) -->\s*$/,
  );
  if (!m) return null;
  const generator = m[1] ?? "";
  const generatedAt = m[2] ?? "";
  const sources: FooterSource[] = [];
  for (let i = sourcesStart + 1; i < sourcesEnd; i++) {
    const ln = (lines[i] ?? "").replace(/^<!--\s+/, "").replace(/\s*-->$/, "");
    const parts = ln.trim().split(/\s+/);
    if (parts.length === 2) {
      sources.push({ path: parts[0] ?? "", sha256: parts[1] ?? "" });
    }
  }
  return { generator, generatedAt, sources };
}
