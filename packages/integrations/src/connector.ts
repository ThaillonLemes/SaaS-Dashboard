import type { TenantId } from '@saas/contracts';

/**
 * Configuration handed to an ERP connector at `connect()` time.
 *
 * INVARIANT: `tenantId` scopes every subsequent request — connector
 * implementations MUST use the credentials only against the named
 * tenant's external account (T1, protocols/TENANT.md).
 */
export interface ConnectorConfig {
  readonly tenantId: TenantId;
  readonly credentials: Record<string, string>;
  readonly baseUrl?: string;
}

/**
 * A single record pulled from an ERP, prior to normalization.
 *
 * INVARIANT: `tenantId` is the partition key — the raw-payload storage
 * layer (block-029) writes one row per `(tenantId, connectorName,
 * entityType, externalId)` tuple and never co-mingles tenants.
 *
 * `raw` is `unknown` because the shape is connector-specific; the
 * canonical-model normalization step (block-031) is the boundary that
 * validates and refines.
 */
export interface RawPayload {
  readonly connectorName: string;
  readonly tenantId: TenantId;
  readonly entityType: string;
  readonly externalId: string;
  readonly pulledAt: Date;
  readonly raw: unknown;
}

/**
 * Contract every ERP adapter implements.
 *
 * INVARIANT: `pull(tenantId, since?)` MUST return only records belonging
 * to the named tenant (T1). Implementations are responsible for scoping
 * the underlying HTTP request to the tenant's credentials issued at
 * `connect()` time; cross-tenant leakage is a class-T1 bug.
 *
 * `name` and `version` identify the adapter for logging, metrics
 * (`connector_pull_total{name,version}`), and storage row provenance.
 *
 * The interface is intentionally minimal — connection persistence
 * (block-026), pull scheduling (block-028), and payload storage
 * (block-029) live in adjacent blocks and consume this interface
 * without extending it.
 */
export interface ErpConnector {
  readonly name: string;
  readonly version: string;
  connect(config: ConnectorConfig): Promise<void>;
  pull(tenantId: TenantId, since?: Date): Promise<RawPayload[]>;
  disconnect(): Promise<void>;
}
