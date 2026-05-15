import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";
import { parse as parseYaml } from "yaml";

const addFormats = (addFormatsImport as unknown as { default?: typeof addFormatsImport }).default
  ?? (addFormatsImport as unknown as typeof addFormatsImport);

export interface ValidationResult {
  valid: boolean;
  tier: string | null;
  errors: string[];
}

let cachedValidator: ManifestValidator | null = null;

export class ManifestValidator {
  private readonly ajv: Ajv2020;
  private readonly schemasByTier = new Map<string, object>();

  constructor(schemaDir: string) {
    this.ajv = new Ajv2020({
      allErrors: true,
      strict: false,
    });
    (addFormats as unknown as (ajv: unknown) => unknown)(this.ajv);

    const entries = readdirSync(schemaDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!ent.name.endsWith(".schema.yaml")) continue;
      const fullPath = resolve(schemaDir, ent.name);
      const schema = parseYaml(readFileSync(fullPath, "utf8")) as Record<
        string,
        unknown
      >;
      const tier = inferTierFromSchema(schema, ent.name);
      if (!tier) continue;
      this.schemasByTier.set(tier, schema);
      this.ajv.addSchema(schema, `manifest-${tier}`);
    }
  }

  validate(frontmatter: Record<string, unknown>): ValidationResult {
    const tier = typeof frontmatter.tier === "string" ? frontmatter.tier : null;
    if (!tier) {
      return {
        valid: false,
        tier: null,
        errors: ["frontmatter missing 'tier' field"],
      };
    }
    const schema = this.schemasByTier.get(tier);
    if (!schema) {
      return {
        valid: false,
        tier,
        errors: [`no schema registered for tier '${tier}'`],
      };
    }
    const validator = this.ajv.compile(schema);
    const ok = validator(frontmatter);
    if (ok) return { valid: true, tier, errors: [] };
    const errors = (validator.errors ?? []).map(formatError);
    return { valid: false, tier, errors };
  }
}

function inferTierFromSchema(
  schema: Record<string, unknown>,
  filename: string,
): string | null {
  const props = schema.properties as Record<string, unknown> | undefined;
  const tierProp = props?.tier as Record<string, unknown> | undefined;
  if (tierProp && typeof tierProp.const === "string") return tierProp.const;
  const m = filename.match(/^manifest-([A-Z])\.schema\.yaml$/);
  return m ? (m[1] ?? null) : null;
}

function formatError(err: ErrorObject): string {
  const path = err.instancePath || "(root)";
  return `${path}: ${err.message ?? "invalid"}`;
}

export function getValidator(schemaDir: string): ManifestValidator {
  if (!cachedValidator) cachedValidator = new ManifestValidator(schemaDir);
  return cachedValidator;
}
