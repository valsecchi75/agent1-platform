# Code Review: Multi-User Isolation Design Spec

**Date:** 2026-04-10  
**Reviewer:** Senior Code Reviewer  
**Status:** DESIGN REVIEW COMPLETE  
**Issues Found:** 11 (3 CRITICAL, 5 HIGH, 3 LOW)

---

## Executive Summary

The multi-user isolation design is **architecturally sound** but has **critical gaps** in middleware header injection security, database schema atomicity, and file system isolation boundaries. The spec correctly identifies the core problem (zero data isolation) and proposes a reasonable solution (per-user encryption, file scoping, RBAC), but several implementation details risk data leaks, race conditions, and backward compatibility issues.

**Recommendation:** Design is approved for implementation with required fixes to CRITICAL issues before coding begins.

---

## Issues by Category

### CRITICAL ISSUES (Must fix before implementation)

#### 1. CRITICAL: Header Injection Vulnerability — Middleware Cannot Safely Inject User Headers

**Location:** Section 1 (Identity Propagation) + `src/proxy.ts`  
**Severity:** CRITICAL  
**Description:**

The design proposes injecting custom headers (`x-user-id`, `x-user-role`, `x-username`) into the request object after JWT verification in middleware, expecting downstream routes to trust these headers.

**The Problem:**
- The middleware lives at `src/proxy.ts` (Edge Runtime)
- Edge Runtime middleware executes BEFORE the request reaches your Next.js handler
- **Headers are mutable client-side and in transit** — a malicious client can forge custom headers before the middleware even sees them
- While `proxy.ts` *verifies* the JWT and *could* inject headers, those headers travel through the HTTP layer where they're exposed
- An attacker could bypass middleware verification by directly calling API routes with crafted headers

**Example Attack:**
```
GET /api/db/generations
Cookie: agent1_session=invalid_token
x-user-id: victim-uuid  // Attacker-provided header
x-user-role: admin       // Attacker claims admin
```

The proxy middleware verifies the JWT is invalid and redirects. But if the middleware is misconfigured or if an API route trusts the header without re-verification, the attacker claims a different user ID.

**Proof in Current Code:**
- `src/proxy.ts` line 44: `const payload = await verifyTokenEdge(token);` — JWT is verified
- But there's no code injecting headers afterward
- If we add headers in middleware, they must be verified in every route (defense in depth fails)

**Solution:**
1. **Extract user from JWT in every route**, not from headers
2. Create a utility function that decodes the JWT passed in cookies (not headers)
3. All routes that access user data call this function at the top
4. Do NOT trust custom headers for identity — they are contextual at best

**Implementation:**
```typescript
// src/lib/auth/getRequestUser.ts
import { verifyToken } from './jwt';

export async function getRequestUser(req: NextRequest): Promise<RequestUser> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) throw new Error('Unauthorized');
  
  const payload = await verifyToken(token);
  if (!payload?.authenticated) throw new Error('Unauthorized');
  
  return {
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  };
}
```

This removes the attack surface: the JWT cookie is tamper-proof (signed), and we never trust headers.

---

#### 2. CRITICAL: Login Route — Env-Auth Users Lack userId in JWT Token

**Location:** Section 1.1 (Login route update) + `src/app/api/auth/login/route.ts`  
**Severity:** CRITICAL  
**Description:**

When using `.env` fallback auth (AUTH_USERS env var), the current login route signs the JWT without including a `userId` claim:

```typescript
// Line 140 in login/route.ts
const token = await signToken({ authenticated: true, username });
// Missing: userId, role
```

The design says to fix this with deterministic UUID v5 generation. But there's a **race condition**: if env-auth is used and DB is unavailable, the user won't have a real `users` table entry. Then when a route tries to insert a generation with `user_id`, it will fail due to foreign key constraint.

**Example Scenario:**
1. App boots with only `.env` auth enabled (DB unavailable)
2. User logs in → signs JWT with synthetic UUID v5
3. User runs a workflow → calls `/api/agent1-save`
4. Route tries to insert generation with `user_id = v5-uuid`
5. DB has no `users` entry for v5-uuid → FK constraint violation → 500 error

**Current Code Confirms Risk:**
- `src/app/api/auth/login/route.ts` line 87-115: Tries DB first, falls back to .env
- If .env is used, no user record is created
- `src/app/api/agent1-save/route.ts` expects valid FK: `FOREIGN KEY (user_id) REFERENCES users(id)`

**Solution:**
When env-auth is used, either:
1. **Create a synthetic user record in DB** at first login (if DB becomes available later)
   - Track env-auth users separately; on first successful DB operation, create the user
2. **OR store env-auth users in a separate in-memory map** with explicit markers
   - Accept that FK constraint fails for env-auth users during DB unavailability
   - Document this as a known limitation

**Recommended Fix:**
Create an `insertOrUpdateEnvUser()` function in `src/app/api/auth/login/route.ts`:
```typescript
async function ensureEnvUserExists(username: string, v5Uuid: string): Promise<string> {
  if (!dbModule) return v5Uuid; // DB unavailable, return synthetic UUID

  try {
    const existing = dbModule.getUserByUsername(username);
    if (existing) return existing.id;
    
    // User doesn't exist — create with env-auth marker
    return await dbModule.createUser({
      username,
      password: 'env-auth', // Dummy password, never used
      displayName: username,
      role: username === 'admin' ? 'admin' : 'user',
    });
  } catch {
    // DB failed, return synthetic UUID (will cause FK issues later if DB comes back)
    return v5Uuid;
  }
}
```

---

#### 3. CRITICAL: Migration Script Race Condition — Non-Atomic File Moves

**Location:** Section 6 (Data Migration)  
**Severity:** CRITICAL (Data Loss Risk)  
**Description:**

The migration script moves files from `storage/output/images/*` → `storage/users/{adminId}/output/images/` sequentially without atomic guarantees. If the process crashes mid-migration:

**Scenario:**
1. Migration starts: `storage/output/images/` has 1000 files
2. Files 1-500 moved successfully
3. Server crashes or out-of-memory during file 501
4. Next restart: Migration marker not written (only written at END)
5. Migration runs again → attempts to move already-moved files → overwrites or skips silently
6. Files 1-500 may be duplicated, missing, or in wrong state

**Current Spec Problem (Section 6, step 9):**
```
9. Write migration marker: Create `storage/.migration-v1-complete`
```

The marker is written AFTER all operations. If any operation before step 9 fails, the marker isn't written, and the migration is re-run from the start.

**Solution:**
1. **Write migration marker BEFORE any file operations**
2. **Use a staging directory** to capture progress
3. **Make file moves idempotent** (check if destination exists before moving)
4. **Log every moved file** to a `.migration-log` so we know where we stopped

**Recommended Implementation:**
```typescript
// src/lib/migration/migrateToMultiUser.ts
const MIGRATION_MARKER = 'storage/.migration-v1-complete';
const MIGRATION_LOG = 'storage/.migration-v1-log.jsonl';

export async function migrateToMultiUser() {
  // Check if migration already completed
  if (fs.existsSync(MIGRATION_MARKER)) {
    console.log('[migration] Already completed');
    return;
  }

  const adminUserId = getAdminUserId();
  console.log(`[migration] Starting migration for admin user: ${adminUserId}`);

  try {
    // BEFORE any changes, mark migration as in-progress
    const logStream = fs.createWriteStream(MIGRATION_LOG, { flags: 'a' });

    // Move files with logging
    for (const file of getAllFilesToMove()) {
      const src = file.oldPath;
      const dst = file.newPath;

      if (fs.existsSync(dst)) {
        logStream.write(JSON.stringify({ file, status: 'skipped', reason: 'destination_exists' }) + '\n');
        continue;
      }

      fs.copyFileSync(src, dst);
      fs.unlinkSync(src);
      logStream.write(JSON.stringify({ file, status: 'moved' }) + '\n');
    }

    logStream.end();

    // Only write marker after all operations succeed
    fs.writeFileSync(MIGRATION_MARKER, new Date().toISOString());
    console.log('[migration] Completed successfully');
  } catch (error) {
    console.error('[migration] Failed:', error);
    throw error; // Re-throw so startup fails; user can retry manually
  }
}
```

This ensures:
- If the process crashes, the log shows exactly where it stopped
- Retrying the migration skips already-moved files
- Marker is only written on full success

---

### HIGH ISSUES (Should fix before implementation)

#### 4. HIGH: Middleware Header Injection — Fallback Missing for Edge Runtime Constraints

**Location:** Section 1 + `src/proxy.ts`  
**Severity:** HIGH  
**Description:**

The middleware at `src/proxy.ts` runs in Next.js Edge Runtime (not Node.js). Edge Runtime has severe constraints:
- No native modules (Node.js-only APIs fail)
- No file system access
- Limited crypto (jose for JWT only)
- 10MB bundle size limit

The spec proposes injecting custom headers in the middleware. But the concern is: if header injection fails or is misconfigured, downstream routes will fall back to reading headers (which are untrusted). There's no explicit fallback plan.

**Example Failure:**
```typescript
// src/proxy.ts (Edge Runtime) — CAN do this:
const payload = await verifyTokenEdge(token); // Uses jose ✓

// But CANNOT do this:
import { decryptUserKey } from './auth/encryption'; // Node.js crypto module ✗
// Error: Cannot use Node.js APIs in Edge Runtime
```

**Current Code:**
- `src/proxy.ts` uses `verifyTokenEdge()` from `@/lib/auth/jwt-edge.ts`
- `jwt-edge.ts` should be Edge-compatible (uses jose)
- But if headers are injected, routes must extract user from headers AND verify JWT
- If JWT verification isn't done in every route, headers become the source of truth → risk

**Solution:**
**Do NOT inject headers in middleware.** Instead:
1. Routes read the JWT token directly from cookies
2. Every route calls `await getRequestUser(req)` which extracts + verifies JWT
3. This works in both Edge Runtime (middleware can still verify JWT) and Node.js routes (full crypto)

This is simpler, more secure, and avoids Edge Runtime constraints.

---

#### 5. HIGH: Database Schema — Missing Indexes on api_calls and daily_stats Filtered by user_id

**Location:** Section 2.2, 2.3 (Database Changes)  
**Severity:** HIGH (Query Performance)  
**Description:**

The spec adds composite indexes for `generations(user_id, created_at DESC)` (good), but the new `user_id` column on `daily_stats` lacks an index, and `api_calls(user_id)` is not proposed.

**Query Impact:**
```sql
-- In admin dashboard: per-user stats
SELECT SUM(total_cost_usd) FROM daily_stats WHERE user_id = ? AND date BETWEEN ? AND ?;
-- Without index on (user_id, date): Full table scan if millions of rows

-- In generation list for user:
SELECT * FROM api_calls WHERE user_id = ? AND created_at > ? ORDER BY created_at DESC;
-- Without index on (user_id, created_at): Full scan of all api_calls
```

**Current Spec (Section 2.2-2.3):**
- Only proposes index on `generations(user_id, created_at DESC)`
- Missing:
  - `idx_api_calls_user_id_created ON api_calls(user_id, created_at DESC)`
  - `idx_daily_stats_user_id_date ON daily_stats(user_id, date DESC)`

**Solution:**
Add to migration schema:
```sql
CREATE INDEX IF NOT EXISTS idx_api_calls_user_id_created 
  ON api_calls(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id_date 
  ON daily_stats(user_id, date DESC);
```

---

#### 6. HIGH: File Deletion on User Removal — Synchronous Blocking Disk I/O

**Location:** Section 3.2 (New routes) — api/admin/users/[id] DELETE  
**Severity:** HIGH (UX + Performance)  
**Description:**

The spec mentions deleting a user cascades via FK (`ON DELETE CASCADE`), which will delete generations. But the spec doesn't mention cascading **file deletion** from `storage/users/{userId}/`.

**Problem:**
- DB deletion is atomic (FK cascade)
- But deleting `storage/users/{userId}/output/` with 1000 files is **blocking synchronous I/O**
- If the directory is large, the HTTP request will timeout (Vercel: 5min, local: configurable)
- User sees "500 error" but the user account is already deleted (data consistency issue)

**Example:**
```typescript
// api/admin/users/[id]/route.ts — DELETE handler
export async function DELETE(req: NextRequest, { params }) {
  const db = getDb();
  
  // Atomic: cascades all generations via FK
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  
  // Blocking: if 10GB of files, this hangs for minutes
  fs.rmSync(`storage/users/${userId}`, { recursive: true });
  
  return NextResponse.json({ success: true });
}
```

**Solution:**
1. **Queue async deletion** instead of blocking
2. **Soft-delete users first** (mark as deleted, hide from UI)
3. **Background job deletes files** asynchronously
4. Or: **Return 202 Accepted** and delete files in the background

**Minimal Fix:**
```typescript
export async function DELETE(req: NextRequest, { params }) {
  const db = getDb();
  const { id: userId } = await params;
  
  // 1. Delete DB records (atomic, fast)
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  
  // 2. Return immediately
  res = NextResponse.json({ success: true });
  
  // 3. Delete files in background (no await)
  // This allows the response to send while cleanup happens
  const filePath = `storage/users/${userId}`;
  setImmediate(() => {
    try {
      fs.rmSync(filePath, { recursive: true });
      console.log(`[cleanup] Deleted user files: ${filePath}`);
    } catch (err) {
      console.error(`[cleanup] Failed to delete: ${filePath}`, err);
      // Log for manual recovery if needed
    }
  });
  
  return res;
}
```

---

#### 7. HIGH: User API Key Encryption — ENCRYPTION_SECRET Not Documented as Rotating

**Location:** Section 2.1 (Database Changes — Encryption)  
**Severity:** HIGH (Key Rotation Risk)  
**Description:**

The spec uses `ENCRYPTION_SECRET` + user_id as salt for per-user key derivation (PBKDF2 → 256-bit key). The spec says:

> **Encryption:** AES-256-GCM using a key derived from `ENCRYPTION_SECRET` env var (32+ bytes, separate from JWT_SECRET). If `ENCRYPTION_SECRET` is not set, auto-generate and write to `.env` on first startup.

**Problem:**
- If `ENCRYPTION_SECRET` is ever rotated, all existing encrypted keys become unreadable
- The spec doesn't mention **key rotation procedure**
- If an ops team changes `ENCRYPTION_SECRET` in `.env`, users lose access to all their API keys
- No migration path or versioning for encrypted values

**Scenario:**
1. App generates `ENCRYPTION_SECRET = xyz123...` and writes to `.env`
2. User stores API key → encrypted with derived key from `xyz123...`
3. Ops team rotates `ENCRYPTION_SECRET` to `abc789...` in `.env`
4. App restarts with new secret
5. Old encrypted keys are now unreadable (decryption fails)
6. User has lost their API key; must re-enter it

**Solution:**
1. **Add a version field** to encrypted keys:
   ```sql
   CREATE TABLE user_api_keys (
     ...
     encryption_version INTEGER DEFAULT 1,  -- Version of encryption scheme used
     ...
   );
   ```

2. **Document secret rotation procedure** in the spec:
   - Before rotating, run a migration to re-encrypt all keys with new secret
   - Or: disable old keys and ask users to re-enter

3. **Implement `reEncryptAllKeys()` function**:
   ```typescript
   async function rotateEncryptionSecret(newSecret: string) {
     const oldSecret = process.env.ENCRYPTION_SECRET;
     const db = getDb();
     
     for (const keyRow of db.prepare('SELECT * FROM user_api_keys').all()) {
       const plainValue = decryptApiKey(keyRow, oldSecret);
       const newEncrypted = encryptApiKey(plainValue, newSecret);
       db.prepare('UPDATE user_api_keys SET encrypted_value=?, iv=?, auth_tag=? WHERE id=?')
         .run(newEncrypted.value, newEncrypted.iv, newEncrypted.authTag, keyRow.id);
     }
   }
   ```

---

#### 8. HIGH: Output-Browser Route — No User Ownership Validation

**Location:** Section 5.2 (File Storage) + `src/app/api/db/media/[...path]/route.ts`  
**Severity:** HIGH (Data Leak)  
**Description:**

The current `/api/db/media/[...path]` route serves any file in `storage/` without checking if the requesting user owns that file:

```typescript
// src/app/api/db/media/[...path]/route.ts — Current code
const relativePath = pathSegments.join("/");
const dataDir = path.join(process.cwd(), "storage");
const fullPath = path.resolve(path.join(dataDir, relativePath));

// ✗ NO CHECK: Who is requesting? Do they own this user_id?
const fileBuffer = await fs.readFile(resolvedPath);
return new NextResponse(fileBuffer, { /* ... */ });
```

The design spec says (Section 5.2):

> The `output-browser` route must validate that the requesting user matches the path's userId (or is admin).

But this is **not implemented** in the current code. When the spec is implemented, this route becomes a critical vulnerability.

**Attack:**
```
User Alice logs in (user_id = alice-uuid)
Alice calls: GET /api/db/media/users/bob-uuid/output/images/agent1_0001.jpg

Current route:
  - Verifies the JWT cookie is valid (Alice is authenticated)
  - But never checks: "Is the user_id in the path owned by Alice?"
  - Returns Bob's image → Data leak
```

**Solution:**
Update route to extract user from JWT and validate path ownership:

```typescript
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // 1. Extract user from JWT
  const user = await getRequestUser(req); // Get from cookie JWT
  
  // 2. Parse path
  const { path: pathSegments } = await params;
  const relativePath = pathSegments.join("/");
  
  // 3. Validate ownership
  if (relativePath.startsWith('users/')) {
    const pathUserId = relativePath.split('/')[1]; // Extract userId from "users/{userId}/..."
    if (user.role !== 'admin' && user.userId !== pathUserId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
  }
  
  // 4. Serve file
  const dataDir = path.join(process.cwd(), "storage");
  const fullPath = path.resolve(path.join(dataDir, relativePath));
  // ... rest of serving logic
}
```

---

### LOW ISSUES (Nice to have)

#### 9. LOW: Admin Panel Stats Aggregation — N+1 Query Pattern

**Location:** Section 7.2 (Admin Panel UI) — api/admin/users/[id]/stats/route.ts  
**Severity:** LOW (UI Performance)  
**Description:**

The spec proposes an admin stats dashboard showing per-user breakdown. The obvious implementation would be:

```typescript
// ✗ N+1: For each user, query stats
const users = db.prepare('SELECT * FROM users').all();
for (const user of users) {
  const stats = db.prepare('SELECT SUM(...) FROM generations WHERE user_id = ?').get(user.id);
  // ...
}
```

This runs one query per user. With 1000 users, it's 1000+ queries.

**Solution:**
Single aggregation query:
```typescript
const stats = db.prepare(`
  SELECT 
    user_id,
    COUNT(*) as generation_count,
    SUM(cost_usd) as total_cost,
    MAX(created_at) as last_gen_time
  FROM generations
  WHERE created_at > ? AND created_at < ?
  GROUP BY user_id
`).all(dateFrom, dateTo);
```

Not critical for v0.9, but worth noting for admin dashboard performance.

---

#### 10. LOW: Migration Marker File — Should Also Validate Schema Changes

**Location:** Section 6 (Data Migration)  
**Severity:** LOW (Maintenance)  
**Description:**

The spec uses a marker file `storage/.migration-v1-complete` to prevent re-running. But if the database schema fails to initialize (e.g., user_api_keys table creation fails), the marker is still written, and the app runs with incomplete schema.

**Better Approach:**
```typescript
// Validate schema before marking as complete
function validateMigrationSchema() {
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = new Set(tables.map(t => t.name));
  
  const required = ['users', 'generations', 'user_api_keys', 'daily_stats'];
  for (const table of required) {
    if (!tableNames.has(table)) {
      throw new Error(`Migration incomplete: missing table ${table}`);
    }
  }
  
  // Also check indexes
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
  // ... validate key indexes exist
}

// In migration:
try {
  // ... do migration
  validateMigrationSchema(); // Throw if schema invalid
  fs.writeFileSync(MIGRATION_MARKER, ...);
} catch {
  throw; // Fail startup, don't write marker
}
```

---

#### 11. LOW: Env-Auth Synthetic UUID — Should Be Documented in Comments

**Location:** Section 1 (Login route update)  
**Severity:** LOW (Developer Understanding)  
**Description:**

The spec proposes deterministic UUID v5 from username for env-auth users. This is good (consistent across restarts), but it's not explained *why* v5 and not v4.

**Why v5?**
- v4 is random → different UUID each restart → can't correlate old sessions
- v5 is deterministic (username → same UUID every time) → sessions persist

**Solution:**
Add a comment in the code:
```typescript
// Env-auth users get a deterministic UUID v5 from their username.
// This ensures the same env-user always maps to the same UUID across restarts,
// allowing session recovery and consistent file storage paths.
// Do NOT use v4 (random) — that would create a new UUID on each restart.
const envUserId = uuidv5(username, NAMESPACE_UUID);
```

---

## Architectural Assessment

### Strengths

1. **Per-user file scoping is sound** — `storage/users/{userId}/output/` prevents cross-user file access
2. **Encrypted API keys at rest** is appropriate — AES-256-GCM is industry standard
3. **Role-based access control** (RBAC) is minimal but sufficient for v0.9
4. **Migration strategy** (one-time, idempotent marker) is reasonable, just needs atomic guards
5. **Backward compatibility** — existing workflows migrate to admin user, no data loss expected
6. **Foreign key cascades** — good for consistency (when user deleted, generations auto-cleaned)

### Weaknesses

1. **Header injection in middleware is anti-pattern** — JWT should be source of truth, not headers
2. **No explicit key rotation plan** for encryption secret — risky for long-term operation
3. **User deletion blocks on file I/O** — can cause HTTP timeouts
4. **Env-auth users lack DB records during unavailability** — FK constraint risks
5. **Output-browser route lacks ownership validation** — data leak vector if not fixed

### Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Header injection data leak | Medium | High | Don't inject headers; extract from JWT in every route |
| Migration file corruption | Low | High | Use atomic moves, logging, idempotent retries |
| Env-auth FK constraint | Medium | Medium | Create synthetic user in DB at login time |
| Output-browser unauthorized access | High | High | Add user ownership check before serving |
| Encryption key rotation breaks access | Medium | High | Add schema versioning + rotation procedure |
| User deletion timeout | Medium | Medium | Background async deletion with 202 response |

---

## Recommendations for Implementation

### Phase 1: Core (Must Do)

- [ ] Fix CRITICAL #1: Extract user from JWT in every route (not headers)
- [ ] Fix CRITICAL #2: Create user record at env-auth login time
- [ ] Fix CRITICAL #3: Make migration atomic with logging
- [ ] Fix HIGH #8: Add user ownership validation to output-browser route

### Phase 2: Important (Should Do)

- [ ] Fix HIGH #5: Add indexes on api_calls and daily_stats
- [ ] Fix HIGH #6: Implement async user deletion (202 response + background job)
- [ ] Fix HIGH #7: Add encryption version tracking + rotation SOP
- [ ] Fix HIGH #4: Document Edge Runtime constraints, avoid header injection

### Phase 3: Nice to Have (Could Do)

- [ ] LOW #9: Review admin stats query for N+1 patterns
- [ ] LOW #10: Add schema validation after migration
- [ ] LOW #11: Add code comments explaining v5 UUID rationale

---

## Testing Checklist

Before merging, verify:

- [ ] **Unit Tests:**
  - Env-auth user creation and UUID consistency
  - User ownership validation in output-browser (positive + negative cases)
  - Encryption/decryption with correct user key
  - Migration idempotency (run twice, expect same result)

- [ ] **Integration Tests:**
  - User A creates generation → stored in `storage/users/A-uuid/output/`
  - User B cannot list/view User A's generations
  - Admin can see all users' data
  - Deleting user cascades to generations + files

- [ ] **Stress Tests:**
  - Migration with 10,000 files (test atomicity + performance)
  - Concurrent API calls from multiple users (test FK/transaction safety)
  - User deletion with 1GB of files (verify no HTTP timeout)

---

## References

- Current Codebase:
  - `src/proxy.ts` — Middleware (Edge Runtime)
  - `src/app/api/auth/login/route.ts` — Auth endpoint
  - `src/app/api/db/media/[...path]/route.ts` — File serving (needs ownership check)
  - `src/app/api/agent1-save/route.ts` — Save generation
  - `src/lib/storage/fileNaming.ts` — Current flat storage (to be replaced)
  - `src/lib/db.ts` — Database module (needs user_api_keys table)

---

## Sign-Off

**Design Status:** APPROVED WITH REQUIRED FIXES

The multi-user isolation design is architecturally valid and addresses the core problem (zero data isolation). However, **implementation must fix the 3 CRITICAL and 5 HIGH issues** identified above before merging to develop. The issues are concrete, actionable, and pose real security and data integrity risks if left unaddressed.

Recommended next step: Implement Phase 1 fixes, create unit tests, then proceed to Phase 2 enhancements.

---

**Reviewed by:** Senior Code Reviewer  
**Date:** 2026-04-10  
**Next Review:** After Phase 1 implementation (CRITICAL fixes complete)
