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

### 1. Identity Propagation — Custom Headers in Middleware

**File:** `src/proxy.ts`

The Edge middleware already verifies the JWT and checks `payload.authenticated`. The change: after verification, inject the user identity into request headers so every API route can read it without re-decoding the JWT.

**Headers injected:**
- `x-user-id` — UUID from JWT `userId` claim
- `x-user-role` — `admin` or `user` from JWT `role` claim
- `x-username` — username string

**Fallback for env-only auth:** The login route for env-based auth currently signs a JWT without `userId`. This must be fixed: env-auth users get a synthetic UUID (deterministic from username via UUID v5) and `role: user`. The admin env-user gets `role: admin`.

**Helper function** (`src/lib/auth/getRequestUser.ts`):
```typescript
export interface RequestUser {
  userId: string;
  username: string;
  role: 'admin' | 'user';
}

export function getRequestUser(req: NextRequest): RequestUser {
  const userId = req.headers.get('x-user-id');
  const username = req.headers.get('x-username');
  const role = req.headers.get('x-user-role') as 'admin' | 'user';
  
  if (!userId || !username || !role) {
    throw new Error('Missing auth headers — middleware misconfigured');
  }
  
  return { userId, username, role };
}
```

Every API route that accesses user-scoped data calls `getRequestUser(req)` and uses the returned `userId` for all DB queries and file operations.

**Login route update** (`src/app/api/auth/login/route.ts`):
- DB auth: already includes `userId` in JWT. Add `role` claim from `dbUser.role`.
- Env auth: generate deterministic UUID for username, include in JWT with `role: 'admin'` for admin username, `role: 'user'` for others.

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

#### 2.2 New index on `generations`

```sql
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id_created ON generations(user_id, created_at DESC);
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

#### 3.3 Admin-only middleware guard

```typescript
export function requireAdmin(req: NextRequest): RequestUser {
  const user = getRequestUser(req);
  if (user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required');
  }
  return user;
}
```

Used in all `api/admin/*` routes.

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

A one-time migration script runs on first startup after the update:

1. **Detect migration needed:** Check if `storage/users/` directory exists. If not, run migration.
2. **Get admin userId** from `users` table.
3. **Create admin directory** at `storage/users/{adminId}/output/{images,videos,audio}/`.
4. **Move files:** `storage/output/images/*` → `storage/users/{adminId}/output/images/`  (same for videos, audio, input).
5. **Update DB paths:** `UPDATE generations SET file_path = REPLACE(file_path, 'output/', 'users/{adminId}/output/')`.
6. **Move session files:** `storage/workflows/__session/*` → `storage/users/{adminId}/workflows/__session/`.
7. **Attribute existing data:** `UPDATE generations SET user_id = '{adminId}' WHERE user_id IS NULL OR user_id = 'admin'`.
8. **Update daily_stats:** `UPDATE daily_stats SET user_id = '{adminId}' WHERE user_id IS NULL`.
9. **Write migration marker:** Create `storage/.migration-v1-complete` to prevent re-running.

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

1. **API keys encrypted at rest** with AES-256-GCM, user-specific derived keys
2. **No global API key fallback** — each user manages their own keys
3. **Admin keys invisible** to non-admin users
4. **File path validation** — output-browser route checks userId ownership
5. **Client-provided userId ignored** — always use JWT-extracted userId
6. **Role enforcement** — admin routes reject non-admin users with 403
7. **ENCRYPTION_SECRET** auto-generated and stored in .env (never committed)
8. **API key values shown only once** at creation time, then masked forever

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
- `src/proxy.ts` — inject user headers
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
