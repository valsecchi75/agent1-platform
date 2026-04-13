# Multi-User Isolation — Design Spec

**Date:** 2026-04-10
**Status:** Design
**Branch:** `feature/multi-user-isolation` (from `develop`)
**Author:** Claude + Sergio

---

## Problem

Agent 1 has a working authentication system (JWT, bcrypt, SQLite) but zero data isolation between users. Every API route that accesses user data defaults to a hardcoded admin user via `resolveAdminId()` or `getAdminUserId()`. The middleware (`proxy.ts`) verifies the JWT but does not extract or propagate the user identity to downstream routes. The result: all generations, sessions, workflows, and files are attributed to "admin" regardless of who is logged in.

## Decision

Implement complete per-user data isolation across all layers: middleware, API routes, database queries, file storage, and session persistence. Each user sees only their own data. Admin sees global data plus user management.

---

## Architecture

### 1. Identity Propagation — JWT Extraction in Routes

**Approach:** Each API route extracts user identity directly from the JWT cookie using a shared helper function. This is more secure than header injection because JWT tokens are cryptographically signed and tamper-proof, whereas HTTP headers can be spoofed by clients.

**Why not middleware headers:** The Edge middleware (`proxy.ts`) runs in Edge Runtime and could inject headers, but custom headers like `x-user-id` are mutable — a malicious client could set them directly, bypassing the middleware entirely on misconfigured deployments. JWT extraction in each route is tamper-proof by design.

**Middleware change** (`src/proxy.ts`): No functional change beyond existing auth check. The middleware continues to verify the JWT and reject unauthenticated requests. It does NOT inject user headers.

**Helper function** (`src/lib/auth/getRequestUser.ts`):
```typescript
import { verifyToken } from './jwt';

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
    throw new AuthError(401, 'Invalid token');
  }
  
  return {
    userId: payload.userId as string,
    username: payload.username as string,
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

The JWT is verified once per request via `verifyToken()` (HS256, ~0.1ms). This is negligible overhead compared to the DB/file operations that follow.

Every API route that accesses user-scoped data calls `await getRequestUser(req)` and uses the returned `userId` for all DB queries and file operations.

**Login route update** (`src/app/api/auth/login/route.ts`):
- DB auth: already includes `userId` in JWT. Add `role` claim from `dbUser.role`.
- Env auth: at login time, create a real DB user record if one doesn't exist (via `createUser()` with the env username and a hashed password). This ensures every authenticated user has a valid DB row with a real UUID, avoiding FK constraint violations when saving generations. The JWT is then signed with `userId`, `username`, and `role` just like DB auth.

**Env-auth DB record creation** (in login route):
```typescript
// Env-auth fallback: ensure user exists in DB
let dbUser = getUserByUsername(username);
if (!dbUser) {
  const userId = await createUser({
    username,
    password,  // already validated against env
    displayName: username,
    role: username === 'admin' ? 'admin' : 'user',
  });
  dbUser = getUserById(userId);
}
const token = await signToken({
  authenticated: true,
  username: dbUser.username,
  userId: dbUser.id,
  role: dbUser.role,
});
```

### 2. Database Changes

#### 2.1 New table: `user_api_keys`

```sql
CREATE TABLE IF NOT EXISTS user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,          -- e.g. 'GEMINI_API_KEY'
  encrypted_value TEXT NOT NULL,   -- AES-256-GCM encrypted
  iv TEXT NOT NULL,                -- initialization vector (hex)
  auth_tag TEXT NOT NULL,          -- GCM authentication tag (hex)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, key_name)
);
```

**Encryption:** AES-256-GCM using a key derived from `ENCRYPTION_SECRET` env var (32+ bytes, separate from JWT_SECRET). If `ENCRYPTION_SECRET` is not set, auto-generate and write to `.env` on first startup (same pattern as JWT_SECRET).

**Key derivation:** `ENCRYPTION_SECRET` + user_id as salt → PBKDF2 → 256-bit key. Each user's keys are encrypted with a user-specific derived key, so even if two users store the same API key, the ciphertext differs.

#### 2.2 New indexes

```sql
-- Generations: fast per-user queries
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id_created ON generations(user_id, created_at DESC);

-- API calls: per-user cost reports
CREATE INDEX IF NOT EXISTS idx_api_calls_user_id ON api_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_user_id_created ON api_calls(user_id, created_at DESC);
```

#### 2.3 `daily_stats` — add user_id

```sql
ALTER TABLE daily_stats ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id ON daily_stats(user_id);
```

Existing rows get the admin user_id. New rows always include user_id. Report queries filter by user_id for regular users; admin sees aggregated data.

#### 2.4 New db.ts functions

```typescript
// User CRUD
listUsers(): DbUser[]
deleteUser(userId: string): void
updateUser(userId: string, updates: { display_name?: string, role?: string }): void
updateUserPassword(userId: string, newPasswordHash: string): void

// API Keys (encrypted)
setUserApiKey(userId: string, keyName: string, plainValue: string): void
getUserApiKey(userId: string, keyName: string): string | null  // returns decrypted
getUserApiKeyMasked(userId: string, keyName: string): string | null  // returns "...last4"
listUserApiKeys(userId: string): { keyName: string, masked: string, updatedAt: string }[]
deleteUserApiKey(userId: string, keyName: string): void
```

### 3. API Route Changes

Every route that currently uses `resolveAdminId()` or `getAdminUserId()` gets updated to use `getRequestUser(req).userId`.

#### 3.1 Routes to update

| Route | Current behavior | New behavior |
|-------|-----------------|-------------|
| `api/db/generations` GET | Returns all generations | Filter by `user_id` from JWT. Admin can pass `?all=true` for global view. |
| `api/db/generations` POST | Accepts client-provided userId | Ignore client userId, use JWT userId. |
| `api/db/session` GET/POST | `resolveAdminId()` | `getRequestUser(req).userId` |
| `api/agent1-save` POST | `getAdminUserId()` | `getRequestUser(req).userId` + user-scoped file path |
| `api/session/persist` POST | `resolveAdminId()` | `getRequestUser(req).userId` |
| `api/session/restore` GET | `resolveAdminId()` | `getRequestUser(req).userId` |
| `api/settings` GET | Returns shared .env keys | Returns user's own encrypted keys (masked) |
| `api/settings` PUT | Writes to .env | Encrypts and stores in `user_api_keys` |
| `api/workflow` GET/POST | Shared workflow storage | User-scoped workflow directory |
| `api/db/reports` GET | Global aggregation | Filter by userId; admin gets global option |

#### 3.2 New routes

| Route | Purpose |
|-------|---------|
| `api/admin/users` GET | List all users (admin only) |
| `api/admin/users` POST | Create new user (admin only) |
| `api/admin/users/[id]` PUT | Update user (admin only) |
| `api/admin/users/[id]` DELETE | Delete user (admin only) |
| `api/admin/users/[id]/stats` GET | User stats for admin dashboard |
| `api/user/profile` GET/PUT | Current user profile (display name, password change) |
| `api/user/api-keys` GET | List own API keys (masked) |
| `api/user/api-keys` POST | Set an API key |
| `api/user/api-keys/[keyName]` DELETE | Delete an API key |

#### 3.3 Admin-only guard

The `requireAdmin()` function is defined in `getRequestUser.ts` (see Section 1). Used in all `api/admin/*` routes. Returns the authenticated user or throws 403.

#### 3.4 User deletion handling

When an admin deletes a user:
1. DB cascade deletes generations, api_calls, user_sessions, user_api_keys (ON DELETE CASCADE)
2. File cleanup is async: a background job removes `storage/users/{userId}/` directory
3. The API returns success immediately; file cleanup happens in a `setTimeout(fn, 0)` after response
4. If file cleanup fails, orphaned directories can be cleaned up manually (logged as warning)

### 4. API Key Resolution at Generation Time

When a node executes and needs an API key (e.g., `GEMINI_API_KEY`):

1. Check `user_api_keys` table for the authenticated user
2. If found → decrypt and use
3. If not found → return error "API key not configured. Please add your {keyName} in Settings."

No fallback to `.env` global keys. The `.env` keys remain for the server's own use (JWT_SECRET, ENCRYPTION_SECRET, etc.) but are never used for AI generation.

**Exception:** The admin user's keys in `user_api_keys` are treated the same as any other user's. Admin does not get special .env fallback.

**Implementation in generation routes** (`api/generate/route.ts`, `api/llm/route.ts`, etc.):
```typescript
const user = getRequestUser(req);
const apiKey = getUserApiKey(user.userId, 'GEMINI_API_KEY');
if (!apiKey) {
  return NextResponse.json({ 
    error: 'API key not configured',
    detail: 'Add your Gemini API key in Settings > API Keys'
  }, { status: 403 });
}
```

### 5. File Storage Isolation

**File:** `src/lib/storage/fileNaming.ts`

#### 5.1 New directory structure

```
storage/
  users/
    {userId}/
      output/
        images/
        videos/
        audio/
      input/
      workflows/
        __session/
  workflows/          ← shared templates (read-only for users)
```

#### 5.2 Updated functions

```typescript
// New: user-scoped storage paths
export function getUserStoragePaths(userId: string) {
  const userDir = join(STORAGE_DIR, 'users', userId);
  return {
    input: join(userDir, 'input'),
    images: join(userDir, 'output', 'images'),
    videos: join(userDir, 'output', 'videos'),
    audio: join(userDir, 'output', 'audio'),
    workflows: join(userDir, 'workflows'),
    session: join(userDir, 'workflows', '__session'),
  };
}

// Updated: requires userId
export function getNextFilename(
  userId: string,
  type: 'image' | 'video' | 'audio' | 'input',
  extension: string
): { filename: string; fullPath: string; publicUrl: string }
```

The public URL format changes to include user context:
`/api/output-browser?path=users/{userId}/output/images/{filename}`

The `output-browser` route must validate that the requesting user matches the path's userId (or is admin).

#### 5.3 Session persistence

**File:** `src/lib/sessionPersistence.ts`

All functions receive `userId` parameter:
```typescript
saveSessionWorkflow(userId: string, tabId: string, snapshot: any)
loadSessionWorkflow(userId: string, tabId: string)
listSessionWorkflows(userId: string)
saveLastGenerationWorkflow(userId: string, snapshot: any)
```

Session files stored at: `storage/users/{userId}/workflows/__session/tab_{tabId}.json`

### 6. Data Migration

A one-time migration script runs on first startup after the update. The migration is designed to be **idempotent and crash-safe**: if the process is interrupted mid-migration, re-running produces the same result without data loss.

**File:** `src/lib/migration/migrateToMultiUser.ts`

**Trigger:** Called from `db.ts` initialization, after schema creation. Checks for marker file before running.

**Steps:**

1. **Check marker:** If `storage/.migration-v1-complete` exists → skip (already done).
2. **Get admin userId** from `users` table. If no admin user exists, skip (fresh install).
3. **Create target directories:** `storage/users/{adminId}/output/{images,videos,audio}/`, `storage/users/{adminId}/input/`, `storage/users/{adminId}/workflows/__session/`.
4. **Copy files (not move):** For each file in `storage/output/images/*`, copy to `storage/users/{adminId}/output/images/` using `copyFileSync`. Skip files that already exist in the target (idempotent). Log each file copied. Same for videos, audio, input.
5. **Copy session files:** `storage/workflows/__session/*` → `storage/users/{adminId}/workflows/__session/`.
6. **DB updates in a single transaction:**
   ```sql
   BEGIN TRANSACTION;
   UPDATE generations SET file_path = REPLACE(file_path, 'output/', 'users/{adminId}/output/') WHERE file_path NOT LIKE 'users/%';
   UPDATE generations SET user_id = '{adminId}' WHERE user_id IS NULL OR user_id = 'admin';
   UPDATE daily_stats SET user_id = '{adminId}' WHERE user_id IS NULL;
   COMMIT;
   ```
7. **Write marker file:** `storage/.migration-v1-complete` with timestamp and admin userId.
8. **Clean up old directories** (optional, deferred): The old `storage/output/` files are left in place as a backup. A separate cleanup can be run manually after verifying the migration succeeded.

**Why copy not move:** Copying is idempotent — if the process crashes after copying 50 of 100 files, re-running copies the remaining 50 and skips the already-copied ones. Moving is not idempotent: if the process crashes mid-move, some files are in the old location and some in the new, making re-running risky. The old files serve as a backup.

**Why single transaction for DB:** All DB updates are atomic. If any fails, none are applied. On re-run, the `WHERE file_path NOT LIKE 'users/%'` clause ensures already-migrated rows are skipped.

### 7. Admin Panel UI

A new modal dialog accessible from the top bar (visible only to admin role).

#### 7.1 Users tab
- Table: username, display name, role, last login, generations count, total cost
- Actions per row: edit role, reset password, delete (with confirmation)
- "Create User" button → inline form: username, password, display name, role dropdown

#### 7.2 Stats tab
- Per-user breakdown: generation count, cost breakdown by provider, storage used
- Global totals
- Date range filter

#### 7.3 Component structure
```
src/components/admin/
  AdminPanel.tsx          — Main dialog (DialogContent)
  AdminUserList.tsx       — Users table with actions
  AdminUserForm.tsx       — Create/edit user form
  AdminUserStats.tsx      — Per-user statistics
```

Uses existing Dialog primitives from `src/components/ui/dialog.tsx`. Follows the skin/theme system with CSS custom properties.

### 8. User Profile UI

A simpler dialog for non-admin users:
- Change display name
- Change password (requires current password)
- API Keys management: list, add, remove (values shown only at creation time, masked after)

```
src/components/user/
  UserProfile.tsx         — Main dialog
  ApiKeyManager.tsx       — API key CRUD with masked display
```

### 9. Frontend Auth Context

A new React context/hook to provide the current user's identity to frontend components:

```typescript
// src/hooks/useCurrentUser.ts
interface CurrentUser {
  userId: string;
  username: string;
  role: 'admin' | 'user';
}

export function useCurrentUser(): CurrentUser | null
```

Populated from a new lightweight `api/auth/me` endpoint that returns the JWT claims. Called once on app load, cached in Zustand (new `authSlice`).

Used by:
- Top bar to show username and admin/user badge
- AdminPanel to conditionally render
- Settings to show per-user API key management

---

## Security Considerations

1. **JWT extraction per-route** — user identity comes from cryptographically signed JWT, not spoofable headers
2. **API keys encrypted at rest** with AES-256-GCM, user-specific derived keys (PBKDF2 with userId salt)
3. **No global API key fallback** — each user manages their own keys
4. **Admin keys invisible** to non-admin users — each user sees only their own keys
5. **File path validation** — output-browser route checks userId ownership before serving files
6. **Client-provided userId ignored** — always use JWT-extracted userId
7. **Role enforcement** — admin routes reject non-admin users with 403
8. **ENCRYPTION_SECRET** auto-generated and stored in .env (never committed)
9. **API key values shown only once** at creation time, then masked forever
10. **Encryption key rotation** — if ENCRYPTION_SECRET needs to change, a migration script decrypts all keys with the old secret and re-encrypts with the new one. The `user_api_keys` table includes `created_at` to identify keys needing rotation. This is a manual admin operation, not automated.

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Migration corrupts existing data | Migration is idempotent (marker file), file moves are atomic per-file, DB updates in transaction |
| Performance hit from user_id filter | New composite index `(user_id, created_at DESC)` covers common queries |
| Breaking saved workflows without userId | Migration assigns all existing data to admin |
| Env-only auth users without real DB row | Synthetic UUID v5 from username ensures consistency |
| Large storage/users/ with many users | Progressive numbering per-user keeps directories manageable |

## Out of Scope

- HTTPS/SSL configuration (separate infrastructure concern)
- Password complexity policy (tracked separately)
- Refresh token mechanism (tracked separately)
- Auto-update system changes (has its own spec)
- Rate limiting per-user (enhancement for later)
- Team/organization hierarchy (future feature)

## Files Modified (Summary)

### Modified
- `src/proxy.ts` — no functional change (existing auth check sufficient)
- `src/lib/db.ts` — new tables, indexes, CRUD functions, encrypted key storage
- `src/lib/storage/fileNaming.ts` — user-scoped paths
- `src/lib/sessionPersistence.ts` — user-scoped sessions
- `src/app/api/auth/login/route.ts` — add role to JWT, fix env-auth
- `src/app/api/db/generations/route.ts` — filter by userId
- `src/app/api/db/session/route.ts` — use JWT userId
- `src/app/api/agent1-save/route.ts` — use JWT userId + user path
- `src/app/api/session/persist/route.ts` — use JWT userId
- `src/app/api/session/restore/route.ts` — use JWT userId
- `src/app/api/settings/route.ts` — per-user API key CRUD
- `src/app/api/generate/route.ts` — resolve API key from user_api_keys
- `src/app/api/llm/route.ts` — resolve API key from user_api_keys
- `src/app/api/workflow/route.ts` — user-scoped workflows
- `src/app/api/output-browser/route.ts` — validate user ownership

### New Files
- `src/lib/auth/getRequestUser.ts` — helper to extract user from request
- `src/lib/auth/encryption.ts` — AES-256-GCM encrypt/decrypt for API keys
- `src/lib/migration/migrateToMultiUser.ts` — one-time data migration
- `src/app/api/admin/users/route.ts` — user CRUD (admin)
- `src/app/api/admin/users/[id]/route.ts` — user update/delete (admin)
- `src/app/api/admin/users/[id]/stats/route.ts` — user stats (admin)
- `src/app/api/user/profile/route.ts` — self-service profile
- `src/app/api/user/api-keys/route.ts` — API key management
- `src/app/api/user/api-keys/[keyName]/route.ts` — delete API key
- `src/app/api/auth/me/route.ts` — current user info
- `src/components/admin/AdminPanel.tsx` — admin dialog
- `src/components/admin/AdminUserList.tsx` — users table
- `src/components/admin/AdminUserForm.tsx` — create/edit form
- `src/components/admin/AdminUserStats.tsx` — per-user stats
- `src/components/user/UserProfile.tsx` — user profile dialog
- `src/components/user/ApiKeyManager.tsx` — API key UI
- `src/store/slices/authSlice.ts` — auth state in Zustand
- `src/hooks/useCurrentUser.ts` — current user hook
