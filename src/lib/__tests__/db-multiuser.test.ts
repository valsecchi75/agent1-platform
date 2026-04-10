import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TEST_DB = join(tmpdir(), `agent1-test-multiuser-${Date.now()}.db`);

describe('db multi-user functions', () => {
  let adminId: string;

  beforeAll(async () => {
    process.env.__TEST_DB_PATH = TEST_DB;
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-at-least-32-chars-long';
    vi.resetModules();
  });

  afterAll(() => {
    delete process.env.__TEST_DB_PATH;
    try { unlinkSync(TEST_DB); } catch {}
  });

  it('createUser creates a user and returns UUID', async () => {
    const { createUser, getUserById } = await import('../db');
    adminId = await createUser({
      username: 'admin',
      password: 'admin',
      displayName: 'Admin',
      role: 'admin',
    });
    expect(adminId).toBeDefined();
    const user = getUserById(adminId);
    expect(user?.username).toBe('admin');
    expect(user?.role).toBe('admin');
  });

  it('listUsers returns all users', async () => {
    const { listUsers, createUser } = await import('../db');
    await createUser({ username: 'user1', password: 'pass1', displayName: 'User 1', role: 'user' });
    const users = listUsers();
    expect(users.length).toBeGreaterThanOrEqual(2);
  });

  it('updateUser changes display_name and role', async () => {
    const { updateUser, getUserById, listUsers } = await import('../db');
    const users = listUsers();
    const user1 = users.find(u => u.username === 'user1');
    updateUser(user1!.id, { display_name: 'New Name', role: 'admin' });
    const updated = getUserById(user1!.id);
    expect(updated?.display_name).toBe('New Name');
    expect(updated?.role).toBe('admin');
  });

  it('deleteUser removes user and cascades', async () => {
    const { createUser, deleteUser, getUserById } = await import('../db');
    const tempId = await createUser({ username: 'temp', password: 'temp', displayName: 'Temp', role: 'user' });
    deleteUser(tempId);
    expect(getUserById(tempId)).toBeNull();
  });

  it('setUserApiKey stores and getUserApiKey retrieves decrypted key', async () => {
    const { setUserApiKey, getUserApiKey } = await import('../db');
    setUserApiKey(adminId, 'GEMINI_API_KEY', 'AIzaSy-test-key-123');
    const key = getUserApiKey(adminId, 'GEMINI_API_KEY');
    expect(key).toBe('AIzaSy-test-key-123');
  });

  it('getUserApiKey returns null for non-existent key', async () => {
    const { getUserApiKey } = await import('../db');
    const key = getUserApiKey(adminId, 'NONEXISTENT_KEY');
    expect(key).toBeNull();
  });

  it('listUserApiKeys returns masked keys', async () => {
    const { listUserApiKeys } = await import('../db');
    const keys = listUserApiKeys(adminId);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const gemini = keys.find(k => k.keyName === 'GEMINI_API_KEY');
    expect(gemini).toBeDefined();
    expect(gemini?.masked).toMatch(/^\.\.\./);
  });

  it('deleteUserApiKey removes the key', async () => {
    const { deleteUserApiKey, getUserApiKey } = await import('../db');
    deleteUserApiKey(adminId, 'GEMINI_API_KEY');
    expect(getUserApiKey(adminId, 'GEMINI_API_KEY')).toBeNull();
  });

  it('getGenerations filters by user_id', async () => {
    const { insertGeneration, getGenerations } = await import('../db');
    await insertGeneration({
      userId: adminId, filePath: 'test.jpg', fileType: 'image',
      mimeType: 'image/jpeg', prompt: 'test', model: 'test', provider: 'test',
      aspectRatio: '1:1', resolution: '1024x1024', costUsd: 0,
    });
    const result = getGenerations({ userId: adminId });
    expect(result.generations.length).toBeGreaterThanOrEqual(1);
    result.generations.forEach(g => {
      expect(g.user_id).toBe(adminId);
    });
  });
});
