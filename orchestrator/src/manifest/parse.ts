import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface ParsedManifest {
  path: string;
  hasFrontmatter: boolean;
  frontmatter: Record<string, unknown> | null;
  parseError: string | null;
  bodyOffset: number;
}

const DELIM = /^---\s*$/;
const MAX_FRONTMATTER_LINES = 200;

export function parseManifestFile(path: string): ParsedManifest {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    return {
      path,
      hasFrontmatter: false,
      frontmatter: null,
      parseError: `read failed: ${(err as Error).message}`,
      bodyOffset: 0,
    };
  }
  return parseManifestText(path, raw);
}

export function parseManifestText(
  path: string,
  text: string,
): ParsedManifest {
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || !DELIM.test(lines[0] ?? "")) {
    return {
      path,
      hasFrontmatter: false,
      frontmatter: null,
      parseError: null,
      bodyOffset: 0,
    };
  }
  let closeIdx = -1;
  for (let i = 1; i < Math.min(lines.length, MAX_FRONTMATTER_LINES); i++) {
    if (DELIM.test(lines[i] ?? "")) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return {
      path,
      hasFrontmatter: true,
      frontmatter: null,
      parseError: `unterminated frontmatter (no closing '---' within ${MAX_FRONTMATTER_LINES} lines)`,
      bodyOffset: 0,
    };
  }
  const body = lines.slice(1, closeIdx).join("\n");
  try {
    const parsed = parseYaml(body);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        path,
        hasFrontmatter: true,
        frontmatter: null,
        parseError: "frontmatter is not a YAML mapping",
        bodyOffset: closeIdx + 1,
      };
    }
    return {
      path,
      hasFrontmatter: true,
      frontmatter: parsed as Record<string, unknown>,
      parseError: null,
      bodyOffset: closeIdx + 1,
    };
  } catch (err) {
    return {
      path,
      hasFrontmatter: true,
      frontmatter: null,
      parseError: `YAML parse error: ${(err as Error).message}`,
      bodyOffset: closeIdx + 1,
    };
  }
}
