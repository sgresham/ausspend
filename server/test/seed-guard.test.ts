import { describe, expect, it } from 'vitest';
import { assertSeedTarget, databaseNameFromUrl, SEED_DATABASE_NAME } from '../src/seed/guard';

describe('seed target guard', () => {
  it('accepts exactly ausspend_dev', () => {
    expect(SEED_DATABASE_NAME).toBe('ausspend_dev');
    expect(assertSeedTarget('mongodb://10.10.10.30:27017/ausspend_dev')).toBe('ausspend_dev');
    expect(assertSeedTarget('mongodb://10.10.10.30:27017/ausspend_dev?directConnection=true')).toBe(
      'ausspend_dev',
    );
  });

  it('refuses a missing MONGO_URL', () => {
    expect(() => assertSeedTarget(undefined)).toThrow(/MONGO_URL is required/);
    expect(() => assertSeedTarget('')).toThrow(/MONGO_URL is required/);
  });

  it('refuses every other database name', () => {
    for (const url of [
      'mongodb://10.10.10.30:27017/ausspend_prod',
      'mongodb://10.10.10.30:27017/ausspend_test_123',
      'mongodb://10.10.10.30:27017/ausspend_dev_extra',
      'mongodb://10.10.10.30:27017/Ausspend_Dev',
      'mongodb://127.0.0.1:27018/otto_pool',
      'mongodb://10.10.10.30:27017/',
      'mongodb://10.10.10.30:27017',
      'not a url',
    ]) {
      expect(() => assertSeedTarget(url), url).toThrow(/Refusing to seed database/);
    }
  });

  it('parses the database name and strips query strings and trailing slashes', () => {
    expect(databaseNameFromUrl('mongodb://host:27017/ausspend_dev/?retryWrites=true')).toBe(
      'ausspend_dev',
    );
    expect(databaseNameFromUrl('mongodb://host:27017')).toBeNull();
    expect(databaseNameFromUrl('nonsense')).toBeNull();
  });
});
