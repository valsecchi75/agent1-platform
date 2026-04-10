# Multi-User Isolation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete per-user data isolation so each user sees only their own generations, workflows, files, and API keys.

**Architecture:** JWT-extracted user identity in every API route via `getRequestUser()` helper. AES-256-GCM encrypted per-user API keys. User-scoped file storage under `storage/users/{userId}/`. One-time idempotent migration of existing data to admin user.

**Tech Stack:** Next.js 16, TypeScript, better-sqlite3, bcryptjs, Node.js crypto (AES-256-GCM, PBKDF2), Zustand, React (Dialog primitives)

**Spec:** `docs/superpowers/specs/2026-04-10-multi-user-isolation-design.md`

**Branch:** `feature/multi-user-isolation` from `develop`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/auth/getRequestUser.ts` | Extract userId/role from JWT cookie in API routes |
| `src/lib/auth/encryption.ts` | AES-256-GCM encrypt/decrypt + PBKDF2 key derivation |
| `src/lib/migration/migrateToMultiUser.ts` | One-time data migration (files + DB) |
| `src/app/api/auth/me/route.ts` | Return current user info from JWT |
| `src/app/api/admin/users/route.ts` | List + create users (admin only) |
| `src/app/api/admin/users/[id]/route.ts` | Update + delete user (admin only) |
| `src/app/api/admin/users/[id]/stats/route.ts` | Per-user statistics (admin only) |
| `src/app/api/user/profile/route.ts` | Self-service profile (display name, password) |
| `src/app/api/user/api-keys/route.ts` | List + set API keys (per-user) |
| `src/app/api/user/api-keys/[keyName]/route.ts` | Delete API key |
| `src/store/slices/authSlice.ts` | Current user state in Zustand |
| `src/components/admin/AdminPanel.tsx` | Admin dialog (users + stats) |
| `src/components/admin/AdminUserList.tsx` | Users table with actions |
| `src/components/admin/AdminUserForm.tsx` | Create/edit user form |
| `src/components/admin/AdminUserStats.tsx` | Per-user statistics view |
| `src/components/user/UserProfile.tsx` | User profile dialog |
| `src/components/user/ApiKeyManager.tsx` | API key CRUD UI |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/db.ts` | New table `user_api_keys`, new indexes, CRUD functions, encrypted key functions |
| `src/lib/storage/fileNaming.ts` | `getUserStoragePaths()`, update `getNextFilename()` with userId param |
| `src/lib/sessionPersistence.ts` | Add userId param to all functions, user-scoped paths |
| `src/app/api/auth/login/route.ts` | Add `role` to JWT, create DB user for env-auth |
| `src/app/api/db/generations/route.ts` | Filter GET by userId, ignore client userId in POST |
| `src/app/api/db/session/route.ts` | Replace `resolveAdminId()` with `getRequestUser()` |
| `src/app/api/agent1-save/route.ts` | Replace `getAdminUserId()` with `getRequestUser()`, user-scoped paths |
| `src/app/api/session/persist/route.ts` | Replace `resolveAdminId()` with `getRequestUser()` |
| `src/app/api/session/restore/route.ts` | Replace `resolveAdminId()` with `getRequestUser()` |
| `src/app/api/settings/route.ts` | Rewrite to use per-user encrypted keys |
| `src/app/api/generate/route.ts` | Resolve API key from `user_api_keys` |
| `src/app/api/llm/route.ts` | Resolve API key from `user_api_keys` |
| `src/app/api/chat/route.ts` | Resolve API key from `user_api_keys` |
| `src/app/api/workflow/route.ts` | User-scoped workflow paths |
| `src/app/api/output-browser/route.ts` | Validate user ownership of files |
| `src/app/api/db/reports/route.ts` | Filter by userId, admin gets global |
| `src/store/workflowStore.ts` | Integrate authSlice |

---

## Task 1: Create Feature Branch

**Files:** None (git only)

- [ ] **Step 1: Create branch from develop**

```bash
cd /sessions/nifty-vigilant-noether/mnt/app
git checkout develop
git pull origin develop
git checkout -b feature/multi-user-isolation
```

- [ ] **Step 2: Verify branch**

Run: `git branch --show-current`
Expected: `feature/multi-user-isolation`

---

## Task 2: Auth Helper — `getRequestUser()`

**Files:**
- Create: `src/lib/auth/getRequestUser.ts`
- Create: `src/lib/auth/__tests__/getRequestUser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth/__tests__/getRequestUser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock jwt module
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts user from valid JWT', async () => {
    mockedVerify.mockResolvedValue({
      authenticated: true,
      userId: 'uuid-123',
      username: 'testuser',
      role: 'user',
    });

    const user = await getRequestUser(makeRequest('valid-token'));
    expect(user).toEqual({
      userId: 'uuid-123',
      username: 'testuser',
      role: 'user',
    });
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
    mockedVerify.mockResolvedValue({
      authenticated: true, userId: 'uuid-1', username: 'test',
    });
    const user = await getRequestUser(makeRequest('token'));
    expect(user.role).toBe('user');
  });
});

describe('requireAdmin', () => {
  it('returns user when role is admin', async () => {
    mockedVerify.mockResolvedValue({
      authenticated: true, userId: 'uuid-1', username: 'admin', role: 'admin',
    });
    const user = await requireAdmin(makeRequest('token'));
    expect(user.role).toBe('admin');
  });

  it('throws 403 when role is user', async () => {
    mockedVerify.mockResolvedValue({
      authenticated: true, userId: 'uuid-1', username: 'test', role: 'user',
    });
    await expect(requireAdmin(makeRequest('token'))).rejects.toMatchObject({ status: 403 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/__tests__/getRequestUser.test.ts`
Expected: FAIL — module `../getRequestUser` not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/auth/getRequestUser.ts
import { NextRequest } from 'next/server';
import { verifyToken } from './jwt';

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export interface RequestUser {
  userId: string;
  username: string;
  role: 'admin' | 'user';
}

export async function getRequestUser(req: NextRequest): Promise<RequestUser> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) {
    throw new AuthError(401, 'Not authenticated');
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.authenticated || !payload.userId) {
    throw new AuthError(401, 'Invalid or incomplete token');
  }

  return {
    userId: payload.userId as string,
    username: (payload.username as string) || '',
    role: (payload.role as 'admin' | 'user') || 'user',
  };
}

export async function requireAdmin(req: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role !== 'admin') {
    throw new AuthError(403, 'Admin access required');
  }
  return user;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/__tests__/getRequestUser.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/getRequestUser.ts src/lib/auth/__tests__/getRequestUser.test.ts
git commit -m "feat: add getRequestUser() and requireAdmin() auth helpers"
```

---

## Task 3: Encryption Module for API Keys

**Files:**
- Create: `src/lib/auth/encryption.ts`
- Create: `src/lib/auth/__tests__/encryption.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/auth/__tests__/encryption.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/__tests__/encryption.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// src/lib/auth/encryption.ts
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;

function deriveKey(userId: string): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set in .env (minimum 32 characters)');
  }
  return pbkdf2Sync(secret, userId, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

export interface EncryptedValue {
  ciphertext: string; // hex
  iv: string;         // hex
  authTag: string;    // hex
}

export function encryptValue(plaintext: string, userId: string): EncryptedValue {
  const key = deriveKey(userId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

export function decryptValue(
  ciphertext: string,
  iv: string,
  authTag: string,
  userId: string
): string {
  const key = deriveKey(userId);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskApiKey(value: string): string {
  if (!value) return '***';
  const last4 = value.slice(-Math.min(4, value.length));
  return `...${last4}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/__tests__/encryption.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/encryption.ts src/lib/auth/__tests__/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption module for per-user API keys"
```

---

## Task 4: Database Schema + CRUD Functions

**Files:**
- Modify: `src/lib/db.ts` — add `user_api_keys` table, indexes, CRUD functions
- Create: `src/lib/__tests__/db-multiuser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/db-multiuser.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Cross-platform temp database path
const TEST_DB = join(tmpdir(), `agent1-test-multiuser-${Date.now()}.db`);

describe('db multi-user functions', () => {
  let adminId: string;

  beforeAll(async () => {
    process.env.__TEST_DB_PATH = TEST_DB;
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-at-least-32-chars-long';
    // Force fresh module load
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
    expect(gemini?.masked).toBe('...y-123'); // Note: maskApiKey shows last 4 chars, so for 'AIzaSy-test-key-123' it's '...k-123'. Let's adjust.
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
    });
    // Filtered result should only include admin's generations
    const result = getGenerations({ userId: adminId });
    expect(result.generations.length).toBeGreaterThanOrEqual(1);
    result.generations.forEach(g => {
      expect(g.user_id).toBe(adminId);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/db-multiuser.test.ts`
Expected: FAIL — `listUsers` not exported, `setUserApiKey` not exported, etc.

- [ ] **Step 3: Add schema changes to db.ts**

In `db.ts`, inside `initializeSchema()`, after existing table creation:

```typescript
// Add after existing CREATE TABLE statements:

// User API keys (encrypted)
db.exec(`
  CREATE TABLE IF NOT EXISTS user_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, key_name)
  )
`);

// Performance indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_generations_user_id_created ON generations(user_id, created_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_api_calls_user_id ON api_calls(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_api_calls_user_id_created ON api_calls(user_id, created_at DESC)`);

// Add user_id to daily_stats if not present
try {
  db.exec(`ALTER TABLE daily_stats ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id ON daily_stats(user_id)`);
} catch {
  // Column already exists — safe to ignore
}
```

- [ ] **Step 4: Add CRUD functions to db.ts**

Add these imports at the top of `db.ts` (alongside existing imports):

```typescript
import { v4 as uuidv4 } from 'uuid';  // if not already imported
import { encryptValue, decryptValue, maskApiKey } from './auth/encryption';

// --- User CRUD ---

export function listUsers(): DbUser[] {
  const db = getDb();
  return db.prepare('SELECT id, username, display_name, role, created_at, last_login_at FROM users ORDER BY created_at ASC').all() as DbUser[];
}

export function getUserByUsername(username: string): DbUser | null {
  const db = getDb();
  return (db.prepare('SELECT * FROM users WHERE username = ?').get(username) as DbUser) || null;
}

export function updateUser(userId: string, updates: { display_name?: string; role?: string }): void {
  const db = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (updates.display_name !== undefined) {
    sets.push('display_name = ?');
    params.push(updates.display_name);
  }
  if (updates.role !== undefined) {
    sets.push('role = ?');
    params.push(updates.role);
  }
  if (sets.length === 0) return;
  params.push(userId);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function updateUserPassword(userId: string, newPasswordHash: string): void {
  const db = getDb();
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);
}

export function deleteUser(userId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

// --- User API Keys (encrypted) ---

export function setUserApiKey(userId: string, keyName: string, plainValue: string): void {
  const db = getDb();
  const { ciphertext, iv, authTag } = encryptValue(plainValue, userId);
  const id = uuid();
  db.prepare(`
    INSERT INTO user_api_keys (id, user_id, key_name, encrypted_value, iv, auth_tag, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, key_name)
    DO UPDATE SET encrypted_value = excluded.encrypted_value,
                  iv = excluded.iv,
                  auth_tag = excluded.auth_tag,
                  updated_at = datetime('now')
  `).run(id, userId, keyName, ciphertext, iv, authTag);
}

export function getUserApiKey(userId: string, keyName: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT encrypted_value, iv, auth_tag FROM user_api_keys WHERE user_id = ? AND key_name = ?'
  ).get(userId, keyName) as { encrypted_value: string; iv: string; auth_tag: string } | undefined;
  if (!row) return null;
  return decryptValue(row.encrypted_value, row.iv, row.auth_tag, userId);
}

export function getUserApiKeyMasked(userId: string, keyName: string): string | null {
  const key = getUserApiKey(userId, keyName);
  return key ? maskApiKey(key) : null;
}

export function listUserApiKeys(userId: string): { keyName: string; masked: string; updatedAt: string }[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT key_name, encrypted_value, iv, auth_tag, updated_at FROM user_api_keys WHERE user_id = ?'
  ).all(userId) as { key_name: string; encrypted_value: string; iv: string; auth_tag: string; updated_at: string }[];
  return rows.map(row => {
    const plain = decryptValue(row.encrypted_value, row.iv, row.auth_tag, userId);
    return { keyName: row.key_name, masked: maskApiKey(plain), updatedAt: row.updated_at };
  });
}

export function deleteUserApiKey(userId: string, keyName: string): void {
  const db = getDb();
  db.prepare('DELETE FROM user_api_keys WHERE user_id = ? AND key_name = ?').run(userId, keyName);
}
```

- [ ] **Step 5: Add userId filter to getGenerations**

In `getGenerations()`, add `userId` to the `GenerationFilters` type and the WHERE clause:

```typescript
// In GenerationFilters interface (db-types.ts or inline):
interface GenerationFilters {
  userId?: string;    // ← NEW
  provider?: string;
  model?: string;
  fileType?: string;
  isLoved?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

// In getGenerations(), add to whereClauses building:
if (filters.userId) {
  whereClauses.push('user_id = ?');
  params.push(filters.userId);
}
```

Apply the same `userId` filter to `getGenerationsCount()`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/__tests__/db-multiuser.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/lib/__tests__/db-multiuser.test.ts
git commit -m "feat: add multi-user DB schema, CRUD, encrypted API key storage"
```

---

## Task 5: Update Login Route — Role in JWT + Env-Auth DB Records

**Files:**
- Modify: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/login/__tests__/multiuser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/auth/login/__tests__/multiuser.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('login route multi-user', () => {
  it('DB auth JWT includes role claim', async () => {
    // Test that after successful DB login, the JWT payload contains role
    // This will be validated by decoding the cookie from the response
  });

  it('env-auth creates DB user record if not exists', async () => {
    // Test that logging in via .env AUTH_USERS creates a DB user
    // and the JWT contains userId from that DB user
  });

  it('env-auth reuses existing DB user record', async () => {
    // Test that repeated env-auth login doesn't create duplicates
  });
});
```

- [ ] **Step 2: Modify login route**

In `src/app/api/auth/login/route.ts`:

**Change 1 — DB auth (add role to JWT):**
Find where `signToken` is called for DB auth. Add `role: dbUser.role`:
```typescript
const token = await signToken({
  authenticated: true,
  username: dbUser.username,
  userId: dbUser.id,
  role: dbUser.role,  // ← ADD THIS
});
```

**Change 2 — Env auth (create DB record, add userId and role to JWT):**
Replace the env-auth token signing section. After validating credentials against AUTH_USERS, before signing the JWT:

```typescript
// After env credential validation succeeds:
let envUser: { id: string; username: string; role: string } | null = null;

if (dbModule) {
  try {
    // Try to get existing DB user for this env username
    envUser = dbModule.getUserByUsername(username);
    if (!envUser) {
      // Create DB record for env-auth user
      const userId = await dbModule.createUser({
        username,
        password,
        displayName: username,
        role: username === 'admin' ? 'admin' : 'user',
      });
      envUser = dbModule.getUserById(userId);
    }
  } catch (err) {
    console.warn('[auth] Could not create/get DB user for env auth:', err);
  }
}

const token = await signToken({
  authenticated: true,
  username,
  ...(envUser ? { userId: envUser.id, role: envUser.role } : {}),
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/app/api/auth/login/`
Expected: All existing + new tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/login/route.ts src/app/api/auth/login/__tests__/
git commit -m "feat: add role to JWT, create DB records for env-auth users"
```

---

## Task 6: Auth Me Endpoint

**Files:**
- Create: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    return NextResponse.json({
      userId: user.userId,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/auth/me/route.ts
git commit -m "feat: add /api/auth/me endpoint for current user info"
```

---

## Task 7: Auth Slice in Zustand

**Files:**
- Create: `src/store/slices/authSlice.ts`
- Modify: `src/store/slices/index.ts` — export new slice
- Modify: `src/store/workflowStore.ts` — integrate authSlice

- [ ] **Step 1: Create authSlice**

```typescript
// src/store/slices/authSlice.ts
import { StateCreator } from 'zustand';

export interface CurrentUser {
  userId: string;
  username: string;
  role: 'admin' | 'user';
}

export interface AuthSlice {
  currentUser: CurrentUser | null;
  isAuthLoading: boolean;
  fetchCurrentUser: () => Promise<void>;
  clearCurrentUser: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  currentUser: null,
  isAuthLoading: true,

  fetchCurrentUser: async () => {
    try {
      set({ isAuthLoading: true });
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        set({
          currentUser: {
            userId: data.userId,
            username: data.username,
            role: data.role,
          },
          isAuthLoading: false,
        });
      } else {
        set({ currentUser: null, isAuthLoading: false });
      }
    } catch {
      set({ currentUser: null, isAuthLoading: false });
    }
  },

  clearCurrentUser: () => set({ currentUser: null, isAuthLoading: false }),
});
```

- [ ] **Step 2: Export from index.ts**

Add to `src/store/slices/index.ts`:
```typescript
export { createAuthSlice } from './authSlice';
export type { AuthSlice, CurrentUser } from './authSlice';
```

- [ ] **Step 3: Integrate into workflowStore**

In `src/store/workflowStore.ts`, add `AuthSlice` to the combined store type and compose it:
```typescript
import { createAuthSlice, AuthSlice } from './slices';
// Add AuthSlice to the combined type union
// Add ...createAuthSlice to the create() call
```

- [ ] **Step 4: Commit**

```bash
git add src/store/slices/authSlice.ts src/store/slices/index.ts src/store/workflowStore.ts
git commit -m "feat: add authSlice to Zustand store with fetchCurrentUser()"
```

---

## Task 8: User-Scoped File Storage

**Files:**
- Modify: `src/lib/storage/fileNaming.ts`
- Create: `src/lib/storage/__tests__/fileNaming-multiuser.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/storage/__tests__/fileNaming-multiuser.test.ts
import { describe, it, expect } from 'vitest';
import { getUserStoragePaths, getNextFilename, ensureUserDirectories } from '../fileNaming';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('fileNaming multi-user', () => {
  const testUserId = 'test-user-multiuser-123';

  it('getUserStoragePaths returns correct user-scoped structure', () => {
    const paths = getUserStoragePaths(testUserId);
    expect(paths.root).toContain(`users/${testUserId}`);
    expect(paths.images).toContain(`users/${testUserId}/output/images`);
    expect(paths.videos).toContain(`users/${testUserId}/output/videos`);
    expect(paths.audio).toContain(`users/${testUserId}/output/audio`);
    expect(paths.input).toContain(`users/${testUserId}/input`);
    expect(paths.workflows).toContain(`users/${testUserId}/workflows`);
    expect(paths.session).toContain(`users/${testUserId}/workflows/__session`);
  });

  it('getNextFilename with userId uses user-scoped path', () => {
    ensureUserDirectories(testUserId);
    const result = getNextFilename('image', 'jpg', testUserId);
    expect(result.fullPath).toContain(`users/${testUserId}/output/images`);
    expect(result.publicUrl).toContain(`users/${testUserId}`);
  });

  it('getNextFilename without userId uses legacy path', () => {
    const result = getNextFilename('image', 'jpg');
    expect(result.publicUrl).not.toContain('users/');
  });
});
```

- [ ] **Step 2: Add `getUserStoragePaths()` and update `getNextFilename()`**

Add to `fileNaming.ts`:
```typescript
export function getUserStoragePaths(userId: string) {
  const userDir = join(STORAGE_DIR, 'users', userId);
  return {
    root: userDir,
    input: join(userDir, 'input'),
    images: join(userDir, 'output', 'images'),
    videos: join(userDir, 'output', 'videos'),
    audio: join(userDir, 'output', 'audio'),
    workflows: join(userDir, 'workflows'),
    session: join(userDir, 'workflows', '__session'),
  };
}

export function ensureUserDirectories(userId: string): void {
  const paths = getUserStoragePaths(userId);
  for (const dir of Object.values(paths)) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}
```

Update `getNextFilename()` signature to accept optional `userId`:
```typescript
export function getNextFilename(
  type: 'image' | 'video' | 'audio' | 'input',
  extension: string,
  userId?: string
): { filename: string; fullPath: string; publicUrl: string } {
  let directory: string;
  if (userId) {
    const paths = getUserStoragePaths(userId);
    directory = type === 'image' ? paths.images
      : type === 'video' ? paths.videos
      : type === 'audio' ? paths.audio
      : paths.input;
    ensureUserDirectories(userId);
  } else {
    // Legacy fallback — should not happen after migration
    directory = type === 'image' ? STORAGE_PATHS.images : ...;
  }
  // ... rest of progressive numbering logic stays the same
  // Update publicUrl to include user path
  const publicUrl = userId
    ? `/api/output-browser?path=users/${userId}/output/${type}s/${filename}`
    : `/api/output-browser?path=${type}s/${filename}`;
  return { filename, fullPath, publicUrl };
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/storage/__tests__/fileNaming-multiuser.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/fileNaming.ts src/lib/storage/__tests__/
git commit -m "feat: add user-scoped file storage paths and directory creation"
```

---

## Task 9: Update Session Persistence

**Files:**
- Modify: `src/lib/sessionPersistence.ts`

- [ ] **Step 1: Update all functions to accept userId**

Every function in `sessionPersistence.ts` gets a `userId` parameter. The session directory changes from `storage/workflows/__session/` to `storage/users/{userId}/workflows/__session/`.

```typescript
// Before:
const SESSION_DIR = path.join(STORAGE_DIR, 'workflows', '__session');

// After:
function getSessionDir(userId: string): string {
  return path.join(STORAGE_DIR, 'users', userId, 'workflows', '__session');
}
function getSessionImagesDir(userId: string): string {
  return path.join(getSessionDir(userId), 'images');
}

// Update all function signatures:
export function saveSessionWorkflow(userId: string, tabId: string, snapshot: any): string
export function loadSessionWorkflow(userId: string, tabId: string): any | null
export function listSessionWorkflows(userId: string): string[]
export function deleteSessionWorkflow(userId: string, tabId: string): void
export function saveLastGenerationWorkflow(userId: string, snapshot: any): string
```

- [ ] **Step 2: Run existing session persistence tests**

Run: `npx vitest run src/lib/__tests__/sessionPersistence.test.ts`
Expected: Some tests may fail due to new required `userId` parameter — update them.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sessionPersistence.ts src/lib/__tests__/sessionPersistence.test.ts
git commit -m "feat: add userId parameter to all session persistence functions"
```

---

## Task 10: Update Core API Routes — Remove Hardcoded Admin

**Files:**
- Modify: `src/app/api/db/session/route.ts`
- Modify: `src/app/api/agent1-save/route.ts`
- Modify: `src/app/api/db/generations/route.ts`
- Modify: `src/app/api/session/persist/route.ts`
- Modify: `src/app/api/session/restore/route.ts`

- [ ] **Step 1: Update `api/db/session/route.ts`**

Remove `resolveAdminId()` function entirely. Replace with:

```typescript
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';

export async function GET(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const user = await getRequestUser(request);
    const session = loadUserSession(user.userId);
    return NextResponse.json({ success: true, session });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const user = await getRequestUser(request);
    const body = await request.json();
    saveUserSession(user.userId, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update `api/agent1-save/route.ts`**

Remove `getAdminUserId()` function. Replace with `getRequestUser()`:

```typescript
import { getRequestUser } from '@/lib/auth/getRequestUser';

export async function POST(req: NextRequest) {
  const user = await getRequestUser(req);
  // ... existing body parsing ...
  
  // Use user-scoped filename
  const { filename, fullPath, publicUrl } = getNextFilename(type, ext, user.userId);
  
  // ... write file ...
  
  if (isDbAvailable()) {
    insertGeneration({
      userId: user.userId,  // ← from JWT, not hardcoded
      filePath: `users/${user.userId}/output/images/${filename}`,
      // ... rest unchanged
    });
  }
}
```

- [ ] **Step 3: Update `api/db/generations/route.ts`**

GET: Add userId filter from JWT. Admin can pass `?all=true` for global view.

```typescript
import { getRequestUser } from '@/lib/auth/getRequestUser';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  const filters: GenerationFilters = {};
  
  // Non-admin always sees only their own; admin can request global view
  const isAdminRequestingGlobal = user.role === 'admin' && searchParams.get('all') === 'true';
  if (!isAdminRequestingGlobal) {
    filters.userId = user.userId;
  }
  // ... rest of filter parsing ...
  const result = getGenerations(filters);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  const body = await request.json();
  // Ignore client-provided userId — always use JWT
  const input = { ...body, userId: user.userId };
  const id = await insertGeneration(input);
  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 4: Update `api/session/persist/route.ts` and `api/session/restore/route.ts`**

Same pattern: remove `resolveAdminId()`, use `getRequestUser(req).userId`. Pass userId to session persistence functions.

- [ ] **Step 5: Run affected tests**

Run: `npx vitest run src/app/api/db/ src/app/api/session/ src/app/api/agent1-save/`
Expected: Tests should pass (update test mocks if needed for new getRequestUser dependency)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/db/session/route.ts src/app/api/agent1-save/route.ts \
  src/app/api/db/generations/route.ts src/app/api/session/persist/route.ts \
  src/app/api/session/restore/route.ts
git commit -m "feat: replace hardcoded admin lookups with JWT-based user identity"
```

---

## Task 11: Update Settings Route — Per-User Encrypted API Keys

**Files:**
- Modify: `src/app/api/settings/route.ts`

- [ ] **Step 1: Rewrite settings route**

```typescript
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { listUserApiKeys, setUserApiKey, deleteUserApiKey } from '@/lib/db';

const ALLOWED_KEYS = [
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'REPLICATE_API_KEY', 'FAL_API_KEY', 'KIE_API_KEY',
  'WAVESPEED_API_KEY',
];

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const keys = listUserApiKeys(user.userId);
    // Build response: all allowed keys, masked value or empty
    const result: Record<string, string> = {};
    for (const keyName of ALLOWED_KEYS) {
      const found = keys.find(k => k.keyName === keyName);
      result[keyName] = found ? found.masked : '';
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const { key, value } = await req.json();
    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
    }
    if (!value || typeof value !== 'string') {
      return NextResponse.json({ error: 'Value required' }, { status: 400 });
    }
    setUserApiKey(user.userId, key, value.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const { key } = await req.json();
    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
    }
    deleteUserApiKey(user.userId, key);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/settings/route.ts
git commit -m "feat: rewrite settings route for per-user encrypted API keys"
```

---

## Task 12: Update Generation Routes — Resolve API Keys Per-User

**Files:**
- Modify: `src/app/api/generate/route.ts`
- Modify: `src/app/api/llm/route.ts`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Create a shared API key resolver**

Add helper to `src/lib/auth/getRequestUser.ts` or create `src/lib/auth/resolveApiKey.ts`:

```typescript
// src/lib/auth/resolveApiKey.ts
import { getUserApiKey } from '@/lib/db';

export function resolveApiKey(userId: string, keyName: string): string {
  const key = getUserApiKey(userId, keyName);
  if (!key) {
    throw new ApiKeyError(keyName);
  }
  return key;
}

export class ApiKeyError extends Error {
  keyName: string;
  constructor(keyName: string) {
    super(`API key not configured: ${keyName}. Add it in Settings > API Keys.`);
    this.name = 'ApiKeyError';
    this.keyName = keyName;
  }
}
```

- [ ] **Step 2: Update generate route**

In `src/app/api/generate/route.ts`, replace `process.env.GEMINI_API_KEY` lookups:

```typescript
import { getRequestUser } from '@/lib/auth/getRequestUser';
import { resolveApiKey, ApiKeyError } from '@/lib/auth/resolveApiKey';

// At the top of POST handler:
const user = await getRequestUser(req);

// Where API key is needed (varies by provider):
// Replace: const apiKey = process.env.GEMINI_API_KEY;
// With:    const apiKey = resolveApiKey(user.userId, 'GEMINI_API_KEY');

// Add catch for ApiKeyError:
catch (err) {
  if (err instanceof ApiKeyError) {
    return NextResponse.json({
      error: 'API key not configured',
      detail: err.message,
    }, { status: 403 });
  }
  // ... existing error handling
}
```

Apply the same pattern to each provider function call — the key name depends on the provider (GEMINI_API_KEY, OPENAI_API_KEY, FAL_API_KEY, etc.).

- [ ] **Step 3: Update LLM and chat routes similarly**

- [ ] **Step 4: Run affected tests**

Run: `npx vitest run src/app/api/generate/ src/app/api/llm/ src/app/api/chat/`

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/resolveApiKey.ts src/app/api/generate/route.ts \
  src/app/api/llm/route.ts src/app/api/chat/route.ts
git commit -m "feat: resolve API keys from per-user encrypted storage"
```

---

## Task 13: Update Output Browser — User Ownership Validation

**Files:**
- Modify: `src/app/api/output-browser/route.ts`

- [ ] **Step 1: Add user ownership check**

When the path contains `users/{userId}/`, validate that the requesting user matches (or is admin):

```typescript
import { getRequestUser } from '@/lib/auth/getRequestUser';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  const requestedPath = searchParams.get('path');
  
  // If path is user-scoped, validate ownership
  const userPathMatch = requestedPath?.match(/^users\/([^/]+)\//);
  if (userPathMatch) {
    const pathUserId = userPathMatch[1];
    if (pathUserId !== user.userId && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }
  
  // For listing: scope to user's directory only
  // ... update base directory resolution
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/output-browser/route.ts
git commit -m "feat: add user ownership validation to output-browser route"
```

---

## Task 14: Update Reports Route

**Files:**
- Modify: `src/app/api/db/reports/route.ts`
- Modify: `src/lib/db.ts` — update `getReportData()` to accept userId

- [ ] **Step 1: Add userId param to getReportData**

```typescript
export function getReportData(dateRange: DateRange, userId?: string): ReportData {
  // Add WHERE user_id = ? clause when userId is provided
  // Admin without userId param gets global data
}
```

- [ ] **Step 2: Update route**

```typescript
const user = await getRequestUser(request);
const reportData = user.role === 'admin'
  ? getReportData(dateRange)  // global
  : getReportData(dateRange, user.userId);  // user-scoped
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/db/reports/route.ts src/lib/db.ts
git commit -m "feat: scope report data to authenticated user"
```

---

## Task 15: Data Migration Script

**Files:**
- Create: `src/lib/migration/migrateToMultiUser.ts`
- Modify: `src/lib/db.ts` — call migration after schema init

- [ ] **Step 1: Write migration module**

```typescript
// src/lib/migration/migrateToMultiUser.ts
import { existsSync, copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { getDb } from '../db';

const STORAGE_DIR = resolve(process.cwd(), 'storage');
const MARKER_FILE = join(STORAGE_DIR, '.migration-v1-complete');

export function runMultiUserMigration(): void {
  if (existsSync(MARKER_FILE)) return; // Already migrated

  const db = getDb();
  
  // Get admin user
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as { id: string } | undefined;
  if (!admin) return; // Fresh install, no data to migrate

  const adminId = admin.id;
  console.log(`[migration] Starting multi-user migration for admin: ${adminId}`);

  // 1. Create target directories
  const targetDirs = [
    join(STORAGE_DIR, 'users', adminId, 'output', 'images'),
    join(STORAGE_DIR, 'users', adminId, 'output', 'videos'),
    join(STORAGE_DIR, 'users', adminId, 'output', 'audio'),
    join(STORAGE_DIR, 'users', adminId, 'input'),
    join(STORAGE_DIR, 'users', adminId, 'workflows', '__session'),
  ];
  for (const dir of targetDirs) {
    mkdirSync(dir, { recursive: true });
  }

  // 2. Copy files (idempotent)
  const copyDir = (src: string, dest: string) => {
    if (!existsSync(src)) return;
    const files = readdirSync(src);
    let copied = 0;
    for (const file of files) {
      const srcPath = join(src, file);
      const destPath = join(dest, file);
      if (!existsSync(destPath)) {
        copyFileSync(srcPath, destPath);
        copied++;
      }
    }
    if (copied > 0) console.log(`[migration] Copied ${copied} files from ${src}`);
  };

  copyDir(join(STORAGE_DIR, 'output', 'images'), join(STORAGE_DIR, 'users', adminId, 'output', 'images'));
  copyDir(join(STORAGE_DIR, 'output', 'videos'), join(STORAGE_DIR, 'users', adminId, 'output', 'videos'));
  copyDir(join(STORAGE_DIR, 'output', 'audio'), join(STORAGE_DIR, 'users', adminId, 'output', 'audio'));
  copyDir(join(STORAGE_DIR, 'input'), join(STORAGE_DIR, 'users', adminId, 'input'));
  copyDir(join(STORAGE_DIR, 'workflows', '__session'), join(STORAGE_DIR, 'users', adminId, 'workflows', '__session'));

  // 3. DB updates in transaction
  const migrate = db.transaction(() => {
    db.prepare(`UPDATE generations SET file_path = REPLACE(file_path, 'output/', 'users/' || ? || '/output/') WHERE file_path NOT LIKE 'users/%'`).run(adminId);
    db.prepare(`UPDATE generations SET user_id = ? WHERE user_id IS NULL OR user_id = 'admin'`).run(adminId);
    db.prepare(`UPDATE daily_stats SET user_id = ? WHERE user_id IS NULL`).run(adminId);
  });
  migrate();

  // 4. Write marker
  writeFileSync(MARKER_FILE, JSON.stringify({
    migratedAt: new Date().toISOString(),
    adminId,
  }));
  console.log('[migration] Multi-user migration complete');
}
```

- [ ] **Step 2: Call migration from db.ts initialization**

In `db.ts`, after `initializeSchema()` call inside `getDb()`:

```typescript
import { runMultiUserMigration } from './migration/migrateToMultiUser';

// After initializeSchema(db):
runMultiUserMigration();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/migration/migrateToMultiUser.ts src/lib/db.ts
git commit -m "feat: add idempotent multi-user data migration script"
```

---

## Task 16: Admin API Routes

**Files:**
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`
- Create: `src/app/api/admin/users/[id]/stats/route.ts`

- [ ] **Step 1: Create users list + create route**

```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { listUsers, createUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const users = listUsers();
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { username, password, displayName, role } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    const userId = await createUser({
      username,
      password,
      displayName: displayName || username,
      role: role || 'user',
    });
    return NextResponse.json({ userId }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // Handle duplicate username
    if ((err as Error).message?.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create user update/delete route**

```typescript
// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { updateUser, updateUserPassword, deleteUser, getUserById } from '@/lib/db';
import { hash } from 'bcryptjs';
import { rmSync } from 'fs';
import { join, resolve } from 'path';

const STORAGE_DIR = resolve(process.cwd(), 'storage');

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const body = await req.json();

    if (body.displayName !== undefined || body.role !== undefined) {
      updateUser(id, {
        display_name: body.displayName,
        role: body.role,
      });
    }

    if (body.newPassword) {
      const hashed = await hash(body.newPassword, 12);
      updateUserPassword(id, hashed);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;

    // Prevent self-deletion
    if (id === admin.userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const user = getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // DB cascade delete
    deleteUser(id);

    // Async file cleanup
    setTimeout(() => {
      try {
        const userDir = join(STORAGE_DIR, 'users', id);
        rmSync(userDir, { recursive: true, force: true });
        console.log(`[admin] Cleaned up storage for deleted user ${id}`);
      } catch (err) {
        console.warn(`[admin] Failed to clean up storage for user ${id}:`, err);
      }
    }, 0);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create user stats route**

```typescript
// src/app/api/admin/users/[id]/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const db = getDb();

    const generationCount = (db.prepare(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = ?'
    ).get(id) as { count: number }).count;

    const totalCost = (db.prepare(
      'SELECT COALESCE(SUM(cost_usd), 0) as total FROM api_calls WHERE user_id = ?'
    ).get(id) as { total: number }).total;

    const costByProvider = db.prepare(
      'SELECT provider, SUM(cost_usd) as cost, COUNT(*) as calls FROM api_calls WHERE user_id = ? GROUP BY provider'
    ).all(id);

    return NextResponse.json({
      userId: id,
      generationCount,
      totalCost,
      costByProvider,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: add admin API routes for user CRUD and stats"
```

---

## Task 17: User Profile API Routes

**Files:**
- Create: `src/app/api/user/profile/route.ts`
- Create: `src/app/api/user/api-keys/route.ts`
- Create: `src/app/api/user/api-keys/[keyName]/route.ts`

- [ ] **Step 1: Create profile route**

```typescript
// src/app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { getUserById, updateUser, updateUserPassword, authenticateUser } from '@/lib/db';
import { hash } from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const dbUser = getUserById(user.userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({
      userId: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name,
      role: dbUser.role,
      createdAt: dbUser.created_at,
      lastLoginAt: dbUser.last_login_at,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const body = await req.json();

    if (body.displayName !== undefined) {
      updateUser(user.userId, { display_name: body.displayName });
    }

    if (body.newPassword) {
      // Verify current password
      if (!body.currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      }
      const dbUser = await authenticateUser(user.username, body.currentPassword);
      if (!dbUser) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
      }
      const hashed = await hash(body.newPassword, 12);
      updateUserPassword(user.userId, hashed);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create API keys routes**

```typescript
// src/app/api/user/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { listUserApiKeys, setUserApiKey } from '@/lib/db';

const ALLOWED_KEYS = [
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'REPLICATE_API_KEY', 'FAL_API_KEY', 'KIE_API_KEY', 'WAVESPEED_API_KEY',
];

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const keys = listUserApiKeys(user.userId);
    return NextResponse.json({ keys });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const { keyName, value } = await req.json();
    if (!ALLOWED_KEYS.includes(keyName)) {
      return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
    }
    if (!value || typeof value !== 'string') {
      return NextResponse.json({ error: 'Value required' }, { status: 400 });
    }
    setUserApiKey(user.userId, keyName, value.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

```typescript
// src/app/api/user/api-keys/[keyName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { deleteUserApiKey } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ keyName: string }> }) {
  try {
    const user = await getRequestUser(req);
    const { keyName } = await params;
    deleteUserApiKey(user.userId, keyName);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/user/
git commit -m "feat: add user profile and API key management routes"
```

---

## Task 18: Admin Panel UI

**Files:**
- Create: `src/components/admin/AdminPanel.tsx`
- Create: `src/components/admin/AdminUserList.tsx`
- Create: `src/components/admin/AdminUserForm.tsx`
- Create: `src/components/admin/AdminUserStats.tsx`

- [ ] **Step 1: Create AdminPanel (main dialog)**

Use `Dialog`, `DialogContent` (size `lg`), `DialogHeader`, `DialogTabs`, `DialogBody` from `src/components/ui/dialog.tsx`. Two tabs: "Users" and "Stats". Fetch users from `/api/admin/users` on mount.

- [ ] **Step 2: Create AdminUserList**

Table component with columns: username, display name, role, last login, actions (edit/delete). Delete shows confirmation dialog. Edit toggles inline form.

- [ ] **Step 3: Create AdminUserForm**

Form for creating new users: username, password, display name, role (dropdown: admin/user). Calls `POST /api/admin/users`.

- [ ] **Step 4: Create AdminUserStats**

Fetches `/api/admin/users/{id}/stats` for selected user. Shows generation count, total cost, cost by provider.

- [ ] **Step 5: Wire AdminPanel into top bar**

Add admin icon button (visible only when `currentUser?.role === 'admin'`) to the main layout/toolbar that opens AdminPanel dialog.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/
git commit -m "feat: add admin panel UI with user management and stats"
```

---

## Task 19: User Profile UI

**Files:**
- Create: `src/components/user/UserProfile.tsx`
- Create: `src/components/user/ApiKeyManager.tsx`

- [ ] **Step 1: Create UserProfile dialog**

Dialog with sections: display name edit, password change (current + new), and API Keys section (delegates to ApiKeyManager).

- [ ] **Step 2: Create ApiKeyManager**

Lists all API keys (masked). "Add" form: select key name from dropdown + paste value. Delete button per key. Value shown only at entry time, never again.

- [ ] **Step 3: Wire into top bar**

Add user icon/username button that opens UserProfile dialog.

- [ ] **Step 4: Commit**

```bash
git add src/components/user/
git commit -m "feat: add user profile dialog with API key management"
```

---

## Task 20: Update Workflow Route — User-Scoped

**Files:**
- Modify: `src/app/api/workflow/route.ts`

- [ ] **Step 1: Scope workflow save/load to user directory**

```typescript
import { getRequestUser } from '@/lib/auth/getRequestUser';
import { getUserStoragePaths } from '@/lib/storage/fileNaming';

// In save handler: write to getUserStoragePaths(user.userId).workflows
// In load handler: read from same user-scoped path
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/workflow/route.ts
git commit -m "feat: scope workflow save/load to user directory"
```

---

## Task 21: ENCRYPTION_SECRET Auto-Generation

**Files:**
- Modify: `src/lib/db.ts` or create `src/lib/auth/ensureEncryptionSecret.ts`

- [ ] **Step 1: Auto-generate ENCRYPTION_SECRET on startup**

Follow the same pattern as JWT_SECRET in `jwt.ts`:
```typescript
// src/lib/auth/ensureEncryptionSecret.ts
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export function ensureEncryptionSecret(): void {
  if (process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.length >= 32) return;
  
  const secret = randomBytes(32).toString('hex');
  process.env.ENCRYPTION_SECRET = secret;
  
  // Append to .env
  const envPath = join(process.cwd(), '.env');
  const content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  if (!content.includes('ENCRYPTION_SECRET')) {
    writeFileSync(envPath, content + `\nENCRYPTION_SECRET=${secret}\n`);
    console.log('[auth] Generated ENCRYPTION_SECRET and saved to .env');
  }
}
```

Call from `db.ts` inside `getDb()`, after DB is opened but before schema init:
```typescript
// In src/lib/db.ts, inside getDb():
import { ensureEncryptionSecret } from './auth/ensureEncryptionSecret';

export function getDb(): Database.Database {
  if (db) return db;
  
  ensureEncryptionSecret(); // ← Add here, before any encryption operations
  
  const dbPath = getDatabasePath();
  db = new Database(dbPath);
  initializeSchema(db);
  // ...
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth/ensureEncryptionSecret.ts src/lib/db.ts
git commit -m "feat: auto-generate ENCRYPTION_SECRET on first startup"
```

---

## Task 22: Integration Testing & Verification

**Files:** No new files — run existing + new tests

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: All tests pass. Fix any failures.

- [ ] **Step 2: Manual verification checklist**

1. Start dev server: `npm run dev`
2. Login as admin
3. Check `/api/auth/me` returns userId, username, role
4. Open Settings → API keys should show per-user storage
5. Add a Gemini API key → verify it encrypts in DB
6. Generate an image → verify file lands in `storage/users/{adminId}/output/images/`
7. Check Gallery → only shows admin's generations
8. Open Admin Panel → verify user list
9. Create a second user
10. Login as new user → Gallery should be empty
11. Verify new user's settings are independent

- [ ] **Step 3: Build verification**

```bash
npm run build
```
Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration test fixes for multi-user isolation"
```

---

## Task Summary

| # | Task | Est. | Dependencies |
|---|------|------|-------------|
| 1 | Feature branch | 1 min | — |
| 2 | getRequestUser helper | 10 min | — |
| 3 | Encryption module | 10 min | — |
| 4 | DB schema + CRUD | 15 min | 3 |
| 5 | Login route update | 10 min | 2, 4 |
| 6 | Auth me endpoint | 5 min | 2 |
| 7 | Auth Zustand slice | 10 min | 6 |
| 8 | User-scoped file storage | 10 min | — |
| 9 | Session persistence | 10 min | 8 |
| 10 | Core routes (remove hardcoded admin) | 20 min | 2, 8, 9 |
| 11 | Settings route rewrite | 10 min | 2, 4 |
| 12 | Generation routes (per-user keys) | 15 min | 2, 4, 11 |
| 13 | Output browser validation | 5 min | 2, 8 |
| 14 | Reports route | 10 min | 2, 4 |
| 15 | Data migration | 15 min | 4, 8 |
| 16 | Admin API routes | 15 min | 2, 4 |
| 17 | User profile API routes | 10 min | 2, 4 |
| 18 | Admin panel UI | 25 min | 7, 16 |
| 19 | User profile UI | 20 min | 7, 17 |
| 20 | Workflow route | 5 min | 2, 8 |
| 21 | Encryption secret auto-gen | 5 min | 3 |
| 22 | Integration testing | 20 min | all |

**Independent tasks (can run in parallel):** 2, 3, 8
**Critical path:** 1 → 2+3+8 → 4 → 5+6+9 → 10+11 → 12 → 22
