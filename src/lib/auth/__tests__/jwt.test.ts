import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('jwt', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long-for-hs256';
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('signToken returns a string', async () => {
    const { signToken } = await import('../jwt');
    const token = await signToken({ authenticated: true });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifyToken returns payload for valid token', async () => {
    const { signToken, verifyToken } = await import('../jwt');
    const token = await signToken({ authenticated: true });
    const payload = await verifyToken(token);
    expect(payload.authenticated).toBe(true);
  });

  it('verifyToken returns null for invalid token', async () => {
    const { verifyToken } = await import('../jwt');
    const payload = await verifyToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  it('verifyToken returns null for expired token', async () => {
    const { signToken, verifyToken } = await import('../jwt');
    const token = await signToken({ authenticated: true }, '-1h');
    const payload = await verifyToken(token);
    expect(payload).toBeNull();
  });
});
