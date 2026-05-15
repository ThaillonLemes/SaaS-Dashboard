import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface AuditTemplate {
  path: string;
  appliesTo: string;
  scope: string;
  sizeCapBytes: number | null;
  requiredSections: string[];
  requiredPatterns: Array<{ regex: string; label: string }>;
  mutationPattern: string | null;
  owner: string | null;
}

const OPEN = /^<!--\s*audit-template\s*$/;
const CLOSE = /^-->\s*$/;

export function loadAuditTemplate(path: string): AuditTemplate | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const lines = raw.split(/\r?\n/);
  let openIdx = -1;
  let closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (openIdx === -1 && OPEN.test(line)) openIdx = i;
    else if (openIdx !== -1 && CLOSE.test(line)) {
      closeIdx = i;
      break;
    }
  }
  if (openIdx === -1 || closeIdx === -1) return null;

  const body = lines.slice(openIdx + 1, closeIdx).join("\n");
  let parsed: Record<string, unknown>;
  try {
    const v = parseYaml(body);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    parsed = v as Record<string, unknown>;
  } catch {
    return null;
  }

  const appliesTo = typeof parsed["applies-to"] === "string" ? parsed["applies-to"] : "";
  if (!appliesTo) return null;

  const requiredSections = Array.isArray(parsed["required-sections"])
    ? (parsed["required-sections"] as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : [];

  const requiredPatterns = Array.isArray(parsed["required-patterns"])
    ? (parsed["required-patterns"] as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((p) => ({
          regex: typeof p.regex === "string" ? p.regex : "",
          label: typeof p.label === "string" ? p.label : "",
        }))
        .filter((p) => p.regex)
    : [];

  return {
    path,
    appliesTo,
    scope: typeof parsed.scope === "string" ? parsed.scope : "workspace",
    sizeCapBytes:
      typeof parsed["size-cap-bytes"] === "number"
        ? parsed["size-cap-bytes"]
        : null,
    requiredSections,
    requiredPatterns,
    mutationPattern:
      typeof parsed["mutation-pattern"] === "string"
        ? parsed["mutation-pattern"]
        : null,
    owner: typeof parsed.owner === "string" ? parsed.owner : null,
  };
}

const HEADING = /^(#{1,3})\s+(.+?)\s*$/;

export function extractSections(content: string): string[] {
  const out: string[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const m = raw.match(HEADING);
    if (m && m[1] && m[1].length === 2) {
      out.push((m[2] ?? "").trim());
    }
  }
  return out;
}

export function findMissingSections(
  content: string,
  required: string[],
): string[] {
  if (required.length === 0) return [];
  const present = new Set(extractSections(content));
  return required.filter((s) => !present.has(s));
}

export function findMissingPatterns(
  content: string,
  required: AuditTemplate["requiredPatterns"],
): string[] {
  if (required.length === 0) return [];
  const lines = content.split(/\r?\n/);
  const missing: string[] = [];
  for (const p of required) {
    const re = new RegExp(p.regex, "m");
    if (!lines.some((l) => re.test(l))) missing.push(p.label || p.regex);
  }
  return missing;
}
