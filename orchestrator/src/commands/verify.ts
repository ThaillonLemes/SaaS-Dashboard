import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LoadedConfig } from "../config.ts";
import { hashFile, parseFooter } from "../footer.ts";

export interface VerifyResult {
  path: string;
  ok: boolean;
  generator: string | null;
  generatedAt: string | null;
  details: Array<{ source: string; expected: string; actual: string; ok: boolean }>;
  error: string | null;
}

export function runVerify(loaded: LoadedConfig, target: string): VerifyResult {
  const abs = resolve(loaded.workspaceRoot, target);
  if (!existsSync(abs)) {
    return {
      path: abs,
      ok: false,
      generator: null,
      generatedAt: null,
      details: [],
      error: `file not found: ${abs}`,
    };
  }
  const content = readFileSync(abs, "utf8");
  const footer = parseFooter(content);
  if (!footer) {
    return {
      path: abs,
      ok: false,
      generator: null,
      generatedAt: null,
      details: [],
      error: "no governor footer found (not a DERIVED artifact?)",
    };
  }
  const details: VerifyResult["details"] = [];
  let allOk = true;
  for (const src of footer.sources) {
    const srcAbs = resolve(loaded.workspaceRoot, src.path);
    if (!existsSync(srcAbs)) {
      details.push({
        source: src.path,
        expected: src.sha256,
        actual: "(missing)",
        ok: false,
      });
      allOk = false;
      continue;
    }
    const actual = hashFile(srcAbs);
    const ok = actual === src.sha256;
    if (!ok) allOk = false;
    details.push({ source: src.path, expected: src.sha256, actual, ok });
  }
  return {
    path: abs,
    ok: allOk,
    generator: footer.generator,
    generatedAt: footer.generatedAt,
    details,
    error: null,
  };
}
