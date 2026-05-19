import type { TenantId } from '@saas/contracts';
import { describe, expect, it } from 'vitest';

import type {
  ConnectorConfig,
  ErpConnector,
  RawPayload,
} from '../src/connector';
import { IntegrationError } from '../src/errors';

const fakeTenantId = 'tenant-mock' as TenantId;

class MockConnector implements ErpConnector {
  public readonly name = 'mock';
  public readonly version = '0.0.0';

  private connected = false;

  connect(config: ConnectorConfig): Promise<void> {
    if (config.tenantId !== fakeTenantId) {
      return Promise.reject(
        new IntegrationError('AUTH_FAILED', 'tenant mismatch'),
      );
    }
    this.connected = true;
    return Promise.resolve();
  }

  pull(tenantId: TenantId, since?: Date): Promise<RawPayload[]> {
    if (!this.connected) {
      return Promise.reject(
        new IntegrationError('CONNECTION_FAILED', 'not connected'),
      );
    }
    const payload: RawPayload = {
      connectorName: this.name,
      tenantId,
      entityType: 'invoice',
      externalId: 'INV-1',
      pulledAt: since ?? new Date(0),
      raw: { id: 'INV-1' },
    };
    return Promise.resolve([payload]);
  }

  disconnect(): Promise<void> {
    this.connected = false;
    return Promise.resolve();
  }
}

describe('ErpConnector', () => {
  it('MockConnector implements ErpConnector and round-trips a payload', async () => {
    const connector: ErpConnector = new MockConnector();
    await connector.connect({
      tenantId: fakeTenantId,
      credentials: { apiKey: 'k' },
    });

    const payloads = await connector.pull(fakeTenantId);

    expect(payloads).toHaveLength(1);
    expect(payloads[0]?.connectorName).toBe('mock');
    expect(payloads[0]?.entityType).toBe('invoice');

    await connector.disconnect();
  });
});

describe('RawPayload', () => {
  it('carries the tenantId — storage layer (block-029) partitions by it', () => {
    const payload: RawPayload = {
      connectorName: 'mock',
      tenantId: fakeTenantId,
      entityType: 'invoice',
      externalId: 'INV-1',
      pulledAt: new Date(0),
      raw: null,
    };

    expect(payload.tenantId).toBe(fakeTenantId);
  });
});

describe('IntegrationError', () => {
  it('exposes the discriminant code verbatim for each variant', () => {
    const connFailed = new IntegrationError('CONNECTION_FAILED', 'down');
    const authFailed = new IntegrationError('AUTH_FAILED', 'bad token');
    const pullFailed = new IntegrationError('PULL_FAILED', '500');
    const rateLimited = new IntegrationError('RATE_LIMITED', '429');

    expect(connFailed.code).toBe('CONNECTION_FAILED');
    expect(authFailed.code).toBe('AUTH_FAILED');
    expect(pullFailed.code).toBe('PULL_FAILED');
    expect(rateLimited.code).toBe('RATE_LIMITED');
  });

  it('is an Error subclass with the IntegrationError name', () => {
    const err = new IntegrationError('PULL_FAILED', 'boom');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(IntegrationError);
    expect(err.name).toBe('IntegrationError');
    expect(err.message).toBe('boom');
  });
});
