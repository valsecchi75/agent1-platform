import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../jwt', () => ({
  verifyToken: vi.fn(),
}));

import { getRequestUser, requireAdmin, AuthError } from '../getRequestUser';
import { verifyToken } from '../jwt';

const mockedVerify = vi.mocked(verifyToken);

function makeRequest(cookie?: string): NextRequest {
  const url = 'http://localhost:3000/api/test';
  const req = new NextRequest(url, {
    headers: cookie ? { cookie: `agent1_session=${cookie}` } : {},
  });
  return req;
}

describe('getRequestUser', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('extracts user from valid JWT', async () => {
    mockedVerify.mockResolvedValue({ authenticated: true, userId: 'uuid-123', username: 'testuser', role: 'user' });
    const user = await getRequestUser(makeRequest('valid-token'));
    expect(user).toEqual({ userId: 'uuid-123', username: 'testuser', role: 'user' });
  });

  it('throws 401 when no cookie', async () => {
    await expect(getRequestUser(makeRequest())).rejects.toThrow(AuthError);
    await expect(getRequestUser(makeRequest())).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when token is invalid', async () => {
    mockedVerify.mockResolvedValue(null);
    await expect(getRequestUser(makeRequest('bad-token'))).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when token has no userId', async () => {
    mockedVerify.mockResolvedValue({ authenticated: true, username: 'test' });
    await expect(getRequestUser(makeRequest('no-uid-token'))).rejects.toMatchObject({ status: 401 });
  });

  it('defaults role to user when missing', async () => {
    mockedVerify.mockResolvedValue({ authenticated: true, userId: 'uuid-1', username: 'test' });
    const user = await getRequestUser(makeRequest('token'));
    expect(user.role).toBe('user');
  });
});

describe('requireAdmin', () => {
  it('returns user when role is admin', async () => {
    mockedVerify.mockResolvedValue({ authenticated: true, userId: 'uuid-1', username: 'admin', role: 'admin' });
    const user = await requireAdmin(makeRequest('token'));
    expect(user.role).toBe('admin');
  });

  it('throws 403 when role is user', async () => {
    mockedVerify.mockResolvedValue({ authenticated: true, userId: 'uuid-1', username: 'test', role: 'user' });
    await expect(requireAdmin(makeRequest('token'))).rejects.toMatchObject({ status: 403 });
  });
});
