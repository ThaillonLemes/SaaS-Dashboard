import type { LoadedConfig } from "../config.ts";
import type { ScanCache } from "../commands/scan.ts";

export type Severity = "ERROR" | "WARNING";

export interface AuditRule {
  id: string;
  name: string;
  axiom_refs: string[];
  severity: Severity;
  handler: string;
  enabled: boolean;
  config: Record<string, unknown>;
  sourcePath: string;
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  path?: string;
  line?: number;
  detail?: Record<string, unknown>;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  status: "ok" | "error";
  findings: Finding[];
  error?: string;
}

export interface AuditContext {
  loaded: LoadedConfig;
  rule: AuditRule;
  scanCache: ScanCache | null;
  inputs: Set<string>;
}

export type RuleHandler = (ctx: AuditContext) => Promise<Finding[]> | Finding[];
