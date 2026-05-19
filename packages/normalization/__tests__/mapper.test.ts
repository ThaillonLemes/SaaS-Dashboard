import type { TenantId } from '@saas/contracts';
import { describe, expect, it } from 'vitest';

import {
  validateCustomer,
  validateOrder,
  validateProduct,
  type CanonicalCustomer,
  type CanonicalOrder,
  type CanonicalProduct,
  type ErpMapper,
  type RawPayload,
} from '../src/index';

// WHY: branded primitives cannot be constructed from string literals at
// runtime, so tests cast through `unknown` once to fabricate a TenantId.
// Production code constructs TenantId only via the tenancy validator at
// the request boundary.
const tenantId = 'tenant-mock' as unknown as TenantId;

const productMapper: ErpMapper<CanonicalProduct> = {
  connectorName: 'mock',
  map(raw: RawPayload, tid: TenantId): CanonicalProduct {
    return {
      tenantId: tid,
      externalId: pickString(raw, 'id'),
      connectorName: 'mock',
      sku: pickString(raw, 'sku'),
      name: pickString(raw, 'name'),
      priceAmount: pickNumber(raw, 'price'),
      priceCurrency: pickString(raw, 'currency'),
      extensions: {},
      syncedAt: new Date('2026-05-19T00:00:00Z'),
    };
  },
};

function pickString(raw: RawPayload, key: string): string {
  const value = raw[key];
  if (typeof value !== 'string') {
    throw new Error(`mock mapper: expected string at '${key}'`);
  }
  return value;
}

function pickNumber(raw: RawPayload, key: string): number {
  const value = raw[key];
  if (typeof value !== 'number') {
    throw new Error(`mock mapper: expected number at '${key}'`);
  }
  return value;
}

describe('ErpMapper<T>', () => {
  it('a value implementing ErpMapper<CanonicalProduct> compiles and maps', () => {
    const raw: RawPayload = {
      id: 'P-1',
      sku: 'SKU-1',
      name: 'Widget',
      price: 9.99,
      currency: 'USD',
    };

    const product = productMapper.map(raw, tenantId);

    expect(productMapper.connectorName).toBe('mock');
    expect(product.tenantId).toBe(tenantId);
    expect(product.externalId).toBe('P-1');
    expect(product.sku).toBe('SKU-1');
    expect(product.priceAmount).toBe(9.99);
    expect(product.priceCurrency).toBe('USD');
    expect(product.extensions).toEqual({});
    expect(product.syncedAt).toBeInstanceOf(Date);
  });
});

describe('validateProduct', () => {
  it('throws when a required field is missing', () => {
    const incomplete = {
      tenantId,
      externalId: 'P-1',
      connectorName: 'mock',
      // sku missing
      name: 'Widget',
      priceAmount: 9.99,
      priceCurrency: 'USD',
      extensions: {},
      syncedAt: new Date(),
    } as unknown as CanonicalProduct;

    expect(() => {
      validateProduct(incomplete);
    }).toThrow(/sku/);
  });

  it('throws when priceAmount is not a finite number', () => {
    const broken = {
      tenantId,
      externalId: 'P-1',
      connectorName: 'mock',
      sku: 'SKU-1',
      name: 'Widget',
      priceAmount: Number.NaN,
      priceCurrency: 'USD',
      extensions: {},
      syncedAt: new Date(),
    } as unknown as CanonicalProduct;

    expect(() => {
      validateProduct(broken);
    }).toThrow(/priceAmount/);
  });

  it('passes for a complete product', () => {
    const product: CanonicalProduct = {
      tenantId,
      externalId: 'P-1',
      connectorName: 'mock',
      sku: 'SKU-1',
      name: 'Widget',
      priceAmount: 9.99,
      priceCurrency: 'USD',
      extensions: { externalCategory: 'WIDGETS' },
      syncedAt: new Date('2026-05-19T00:00:00Z'),
    };

    expect(() => {
      validateProduct(product);
    }).not.toThrow();
  });
});

describe('validateCustomer', () => {
  it('throws when name is missing', () => {
    const incomplete = {
      tenantId,
      externalId: 'C-1',
      connectorName: 'mock',
      extensions: {},
      syncedAt: new Date(),
    } as unknown as CanonicalCustomer;

    expect(() => {
      validateCustomer(incomplete);
    }).toThrow(/name/);
  });

  it('passes when optional email and phone are omitted', () => {
    const customer: CanonicalCustomer = {
      tenantId,
      externalId: 'C-1',
      connectorName: 'mock',
      name: 'Acme Co.',
      extensions: {},
      syncedAt: new Date(),
    };

    expect(() => {
      validateCustomer(customer);
    }).not.toThrow();
  });

  it('passes when optional email and phone are provided', () => {
    const customer: CanonicalCustomer = {
      tenantId,
      externalId: 'C-2',
      connectorName: 'mock',
      name: 'Acme Co.',
      email: 'ops@acme.co',
      phone: '+55 11 99999-0000',
      extensions: {},
      syncedAt: new Date(),
    };

    expect(() => {
      validateCustomer(customer);
    }).not.toThrow();
  });
});

describe('validateOrder', () => {
  it('throws when status is outside the canonical vocabulary', () => {
    const broken = {
      tenantId,
      externalId: 'O-1',
      connectorName: 'mock',
      customerId: 'C-1',
      totalAmount: 100,
      currency: 'USD',
      status: 'shipped',
      issuedAt: new Date(),
      extensions: {},
      syncedAt: new Date(),
    } as unknown as CanonicalOrder;

    expect(() => {
      validateOrder(broken);
    }).toThrow(/status/);
  });

  it('passes for a complete order', () => {
    const order: CanonicalOrder = {
      tenantId,
      externalId: 'O-1',
      connectorName: 'mock',
      customerId: 'C-1',
      totalAmount: 100,
      currency: 'USD',
      status: 'fulfilled',
      issuedAt: new Date('2026-05-18T00:00:00Z'),
      extensions: {},
      syncedAt: new Date('2026-05-19T00:00:00Z'),
    };

    expect(() => {
      validateOrder(order);
    }).not.toThrow();
  });
});
