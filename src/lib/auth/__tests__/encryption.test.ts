import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('encryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_SECRET = 'a'.repeat(64); // 32 bytes hex
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('encrypts and decrypts a value with userId salt', async () => {
    const { encryptValue, decryptValue } = await import('../encryption');
    const plain = 'sk-my-super-secret-api-key-12345';
    const userId = 'user-uuid-123';
    const encrypted = encryptValue(plain, userId);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(plain);
    const decrypted = decryptValue(encrypted.ciphertext, encrypted.iv, encrypted.authTag, userId);
    expect(decrypted).toBe(plain);
  });

  it('produces different ciphertext for same value with different userId', async () => {
    const { encryptValue } = await import('../encryption');
    const plain = 'same-key';
    const e1 = encryptValue(plain, 'user-1');
    const e2 = encryptValue(plain, 'user-2');
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
  });

  it('fails to decrypt with wrong userId', async () => {
    const { encryptValue, decryptValue } = await import('../encryption');
    const encrypted = encryptValue('secret', 'user-1');
    expect(() => decryptValue(encrypted.ciphertext, encrypted.iv, encrypted.authTag, 'user-2')).toThrow();
  });

  it('masks a key showing only last 4 chars', async () => {
    const { maskApiKey } = await import('../encryption');
    expect(maskApiKey('sk-1234567890abcdef')).toBe('...cdef');
    expect(maskApiKey('ab')).toBe('...ab');
    expect(maskApiKey('')).toBe('***');
  });

  it('throws if ENCRYPTION_SECRET is not set', async () => {
    delete process.env.ENCRYPTION_SECRET;
    const { encryptValue } = await import('../encryption');
    expect(() => encryptValue('test', 'user')).toThrow(/ENCRYPTION_SECRET/);
  });
});
