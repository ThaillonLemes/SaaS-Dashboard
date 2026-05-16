import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/logger';

interface CapturedDestination {
  readonly write: (msg: string) => void;
  readonly records: string[];
}

function capture(): CapturedDestination {
  const records: string[] = [];
  return {
    write(msg) {
      records.push(msg);
    },
    records,
  };
}

describe('createLogger', () => {
  it('emits a JSON record with packageName, level, message, and user fields', () => {
    const dest = capture();
    const logger = createLogger('test-pkg', { destination: dest });

    logger.info('hello', { foo: 'bar' });

    expect(dest.records).toHaveLength(1);
    const record: unknown = JSON.parse(dest.records[0] ?? '');
    expect(record).toMatchObject({
      packageName: 'test-pkg',
      level: 'info',
      message: 'hello',
      foo: 'bar',
    });
    expect((record as { time: string }).time).toMatch(
      /^\d{4}-\d{2}-\d{2}T/u,
    );
  });

  it('includes tenantId and userId when passed in fields', () => {
    const dest = capture();
    const logger = createLogger('test-pkg', { destination: dest });

    logger.info('op', { tenantId: 'tenant-42', userId: 'user-7' });

    const record = JSON.parse(dest.records[0] ?? '') as Record<
      string,
      unknown
    >;
    expect(record['tenantId']).toBe('tenant-42');
    expect(record['userId']).toBe('user-7');
  });

  it('hashes the email field — raw email never appears in output', () => {
    const dest = capture();
    const logger = createLogger('test-pkg', { destination: dest });

    logger.info('signup', { email: 'foo@bar.com' });

    const raw = dest.records[0] ?? '';
    expect(raw).not.toContain('foo@bar.com');
    const record = JSON.parse(raw) as Record<string, unknown>;
    expect(record['email']).toMatch(/^sha256:[a-f0-9]{12}$/u);
  });
});
