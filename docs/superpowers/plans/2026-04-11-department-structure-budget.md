# Department Structure & Budget Management — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the user system with departments, three-tier roles (admin/dept_admin/user), and per-department budget enforcement with monthly auto-reset.

**Architecture:** Flat-departments approach — a new `departments` table plus `department_id` FK on `users`. Budget enforcement as a pre-check in `/api/generate`. Role expansion from 2 to 3 values via SQLite table-recreate migration. Frontend changes confined to AdminPanel tabs and a new budget widget.

**Tech Stack:** Next.js 16, SQLite (better-sqlite3), Zustand, Vitest, bcryptjs, jose (JWT)

**Spec:** `docs/superpowers/specs/2026-04-11-department-structure-budget-design.md`

---

## File Structure

### New files to create

| File | Purpose |
|------|---------|
| `src/lib/departments.ts` | Department CRUD functions + budget operations (DB layer) |
| `src/lib/budget.ts` | Budget pre-check logic, lazy reset, cost estimation |
| `src/app/api/admin/departments/route.ts` | GET (list) + POST (create) departments |
| `src/app/api/admin/departments/[id]/route.ts` | GET + PUT + DELETE single department |
| `src/app/api/admin/departments/[id]/members/route.ts` | GET department members with spend stats |
| `src/app/api/admin/departments/[id]/budget/route.ts` | GET department budget status |
| `src/components/admin/AdminDepartmentList.tsx` | Department list UI for admin panel |
| `src/components/admin/AdminDepartmentForm.tsx` | Create/edit department form |
| `src/components/admin/AdminDepartmentMembers.tsx` | Department members with spend breakdown |
| `src/components/BudgetWidget.tsx` | Canvas toolbar budget indicator |
| `src/__tests__/lib/departments.test.ts` | Unit tests for department DB functions |
| `src/__tests__/lib/budget.test.ts` | Unit tests for budget enforcement logic |
| `src/__tests__/api/departments.test.ts` | API route tests for department endpoints |

### Existing files to modify

| File | Changes |
|------|---------|
| `src/lib/db.ts` | Add `departments` table, migrate `users` table (CHECK constraint + `department_id` column), update `insertGenerationWithCall` to update budget |
| `src/lib/db-types.ts` | Add `DbDepartment`, `CreateDepartmentInput`, update `DbUser`, `CreateUserInput` |
| `src/lib/auth/getRequestUser.ts` | Extend `RequestUser` with `departmentId`/`departmentName`, add `requireDeptAdmin`, `requireDepartmentAccess` |
| `src/types/api.ts` | Add `budgetWarning?`, `budgetExceeded?`, `budgetStatus?` to `GenerateResponse` interface |
| `src/app/api/auth/login/route.ts` | Include `departmentId`/`departmentName` in JWT payload (uses `jwt.ts` for signing — Node.js context, NOT edge) |
| `src/app/api/auth/me/route.ts` | Include `departmentId`/`departmentName` in response |
| `src/app/api/admin/users/route.ts` | Add `department_id` to user creation, filter by dept for dept_admin |
| `src/app/api/admin/users/[id]/route.ts` | Add `department_id` to user update, scope dept_admin to own dept |
| `src/app/api/generate/route.ts` | Add budget pre-check before generation, pass budget warnings in response |
| `src/store/slices/authSlice.ts` | Extend `CurrentUser` with `departmentId`/`departmentName` |
| `src/components/admin/AdminPanel.tsx` | Add "Departments" tab, scope "Users" tab for dept_admin |
| `src/components/admin/AdminUserList.tsx` | Add department column |
| `src/components/admin/AdminUserForm.tsx` | Add department dropdown, dept_admin role option |

### Important notes

- **All relative paths** assume `cwd` is the app root: `/sessions/exciting-compassionate-wright/mnt/app`
- **JWT signing** happens in `src/lib/auth/jwt.ts` (Node.js context). `jwt-edge.ts` (Edge Runtime) only verifies. Budget/department fields go in the JWT payload at sign time.
- **Budget widget** must guard against `currentUser` being null during initial auth loading — only fetch if `departmentId` is truthy and `isAuthLoading` is false.
- **DepartmentName in JWT** is cached at login. If renamed, users see stale name until next login (documented in spec as known limitation). The BudgetWidget should use the fresh `departmentName` from the budget API response, not from the JWT.

---

## Task 1: Database Types & Interfaces

**Files:**
- Modify: `src/lib/db-types.ts` (lines 6-21)
- Test: `src/__tests__/lib/departments.test.ts` (new)

- [ ] **Step 1: Add department types to db-types.ts**

In `src/lib/db-types.ts`, add after line 21 (after `CreateUserInput`):

```typescript
// ── Department types ──

export interface DbDepartment {
  id: string;
  name: string;
  description: string | null;
  budget_monthly: number;
  budget_used: number;
  budget_period_start: string | null; // ISO 8601 UTC
  budget_warning_threshold: number;   // 0.0–1.0, default 0.8
  budget_soft_limit: number;          // USD overage allowed, default 0
  created_at: string;
  updated_at: string;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string;
  budgetMonthly?: number;
  budgetWarningThreshold?: number;
  budgetSoftLimit?: number;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
  budgetMonthly?: number;
  budgetWarningThreshold?: number;
  budgetSoftLimit?: number;
}

export interface DepartmentBudgetStatus {
  departmentId: string;
  departmentName: string;
  budgetMonthly: number;
  budgetUsed: number;
  usageRatio: number;          // 0.0–1.0+
  warningThreshold: number;
  softLimit: number;
  periodStart: string;
  daysRemainingInPeriod: number;
  isWarning: boolean;
  isExceeded: boolean;
}

export interface DepartmentMemberStats {
  userId: string;
  username: string;
  displayName: string | null;
  role: 'admin' | 'dept_admin' | 'user';
  totalCost: number;
  generationCount: number;
  lastActivity: string | null;
}
```

- [ ] **Step 2: Update DbUser and CreateUserInput types**

In `src/lib/db-types.ts`, update the existing interfaces:

At `DbUser` (line 6), change `role` and add `department_id`:
```typescript
export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  role: "admin" | "dept_admin" | "user";
  department_id: string | null;
  created_at: string;
  last_login_at: string | null;
}
```

At `CreateUserInput` (line 16), update:
```typescript
export interface CreateUserInput {
  username: string;
  password: string;
  displayName?: string;
  role?: "admin" | "dept_admin" | "user";
  departmentId?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db-types.ts
git commit -m "feat(types): add department and budget type definitions"
```

---

## Task 2: Database Migration — departments table + users table update

**Files:**
- Modify: `src/lib/db.ts` (lines 101-228 schema init, lines 232-255 createUser, lines 286-344 user helpers)
- Test: `src/__tests__/lib/departments.test.ts`

- [ ] **Step 1: Write test for migration — department table exists after init**

Create `src/__tests__/lib/departments.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

// Each test gets its own DB file
let db: Database.Database;
let dbPath: string;

beforeEach(() => {
  dbPath = path.join('/tmp', `test-${randomUUID()}.db`);
  process.env.__TEST_DB_PATH = dbPath;
});

afterEach(() => {
  try { db?.close(); } catch {}
  try { fs.unlinkSync(dbPath); } catch {}
  delete process.env.__TEST_DB_PATH;
});

describe('departments table migration', () => {
  it('should create departments table with correct columns', async () => {
    // Dynamic import to trigger schema init with test DB
    const { getDb } = await import('../../lib/db');
    db = getDb();

    const tableInfo = db.prepare("PRAGMA table_info(departments)").all() as Array<{ name: string; type: string }>;
    const columnNames = tableInfo.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('description');
    expect(columnNames).toContain('budget_monthly');
    expect(columnNames).toContain('budget_used');
    expect(columnNames).toContain('budget_period_start');
    expect(columnNames).toContain('budget_warning_threshold');
    expect(columnNames).toContain('budget_soft_limit');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
  });

  it('should add department_id column to users table', async () => {
    const { getDb } = await import('../../lib/db');
    db = getDb();

    const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const columnNames = tableInfo.map(c => c.name);

    expect(columnNames).toContain('department_id');
  });

  it('should allow dept_admin role in users table', async () => {
    const { getDb, createUser } = await import('../../lib/db');
    db = getDb();

    // This should NOT throw — dept_admin must be allowed by CHECK constraint
    const userId = await createUser({
      username: 'dept_test',
      password: 'password123',
      role: 'dept_admin',
    });
    expect(userId).toBeTruthy();

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string };
    expect(user.role).toBe('dept_admin');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx vitest run src/__tests__/lib/departments.test.ts`
Expected: FAIL (departments table doesn't exist, dept_admin role blocked by CHECK)

- [ ] **Step 3: Add departments table creation in db.ts**

In `src/lib/db.ts`, after the existing table creations (after line ~202, before indexes), add:

```typescript
    // ── Departments table ──
    db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        budget_monthly REAL DEFAULT 0,
        budget_used REAL DEFAULT 0,
        budget_period_start TEXT,
        budget_warning_threshold REAL DEFAULT 0.8,
        budget_soft_limit REAL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
```

- [ ] **Step 4: Add users table migration (CHECK constraint + department_id)**

In `src/lib/db.ts`, add a migration function called from `initializeSchema()`:

```typescript
function migrateDepartmentSupport(db: Database.Database): void {
  // Step 1: Check if department_id column already exists
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const hasDeptId = columns.some(c => c.name === 'department_id');
  if (hasDeptId) return; // Already migrated

  // Step 2: Recreate users table with updated CHECK + department_id
  // SQLite doesn't support ALTER TABLE DROP CONSTRAINT
  db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'dept_admin', 'user')),
        department_id TEXT REFERENCES departments(id),
        created_at TEXT NOT NULL,
        last_login_at TEXT
      )
    `);

    db.exec(`
      INSERT INTO users_new (id, username, password_hash, display_name, role, created_at, last_login_at)
      SELECT id, username, password_hash, display_name, role, created_at, last_login_at
      FROM users
    `);

    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');

    // Recreate indexes that were on the old table
    // (user_sessions and user_api_keys have FK to users.id — these survive because
    // SQLite FKs are checked at statement time, not at schema time, and we kept the same PKs)
  })();
}
```

Call `migrateDepartmentSupport(db)` from `initializeSchema()` after creating the departments table but before creating indexes.

- [ ] **Step 5: Update createUser to accept departmentId**

In `src/lib/db.ts`, update the `createUser` function (line ~232) to include `department_id`:

```typescript
export async function createUser(input: CreateUserInput): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  const hashedPassword = await bcrypt.hash(input.password, 12);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, department_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.username,
    hashedPassword,
    input.displayName || input.username,
    input.role || "user",
    input.departmentId || null,
    now
  );

  return id;
}
```

- [ ] **Step 6: Update updateUser to accept department_id**

In `src/lib/db.ts`, update the `updateUser` function (line ~319) to support `department_id`:

The existing function builds a dynamic SET clause. Add `department_id` to the allowed fields:

```typescript
export function updateUser(userId: string, updates: { display_name?: string; role?: string; department_id?: string | null }): void {
  const db = getDb();
  const setClauses: string[] = [];
  const values: (string | null)[] = [];

  if (updates.display_name !== undefined) {
    setClauses.push('display_name = ?');
    values.push(updates.display_name);
  }
  if (updates.role !== undefined) {
    setClauses.push('role = ?');
    values.push(updates.role);
  }
  if (updates.department_id !== undefined) {
    setClauses.push('department_id = ?');
    values.push(updates.department_id);
  }

  if (setClauses.length === 0) return;

  values.push(userId);
  db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx vitest run src/__tests__/lib/departments.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 8: Commit**

```bash
git add src/lib/db.ts src/__tests__/lib/departments.test.ts
git commit -m "feat(db): add departments table and users migration for dept_admin role"
```

---

## Task 3: Department CRUD Functions (DB layer)

**Files:**
- Create: `src/lib/departments.ts`
- Test: `src/__tests__/lib/departments.test.ts` (extend)

- [ ] **Step 1: Write tests for department CRUD**

Append to `src/__tests__/lib/departments.test.ts`:

```typescript
describe('department CRUD', () => {
  it('should create a department and return its id', async () => {
    const { createDepartment, getDepartmentById } = await import('../../lib/departments');
    const id = createDepartment({ name: 'Design' });
    expect(id).toBeTruthy();

    const dept = getDepartmentById(id);
    expect(dept).not.toBeNull();
    expect(dept!.name).toBe('Design');
    expect(dept!.budget_monthly).toBe(0);
    expect(dept!.budget_warning_threshold).toBe(0.8);
  });

  it('should reject duplicate department names', async () => {
    const { createDepartment } = await import('../../lib/departments');
    createDepartment({ name: 'Marketing' });
    expect(() => createDepartment({ name: 'Marketing' })).toThrow();
  });

  it('should list all departments', async () => {
    const { createDepartment, listDepartments } = await import('../../lib/departments');
    createDepartment({ name: 'Dept A' });
    createDepartment({ name: 'Dept B' });
    const depts = listDepartments();
    expect(depts.length).toBeGreaterThanOrEqual(2);
  });

  it('should update department fields', async () => {
    const { createDepartment, updateDepartment, getDepartmentById } = await import('../../lib/departments');
    const id = createDepartment({ name: 'Old Name' });
    updateDepartment(id, { name: 'New Name', budgetMonthly: 500 });
    const dept = getDepartmentById(id);
    expect(dept!.name).toBe('New Name');
    expect(dept!.budget_monthly).toBe(500);
  });

  it('should delete an empty department', async () => {
    const { createDepartment, deleteDepartment, getDepartmentById } = await import('../../lib/departments');
    const id = createDepartment({ name: 'Temp' });
    deleteDepartment(id);
    expect(getDepartmentById(id)).toBeNull();
  });

  it('should reject deleting a department with members', async () => {
    const { createDepartment, deleteDepartment } = await import('../../lib/departments');
    const { createUser } = await import('../../lib/db');
    const deptId = createDepartment({ name: 'Full Dept' });
    await createUser({ username: 'member1', password: 'pass123', departmentId: deptId });
    expect(() => deleteDepartment(deptId)).toThrow(/active members/i);
  });

  it('should list department members with stats', async () => {
    const { createDepartment, getDepartmentMembers } = await import('../../lib/departments');
    const { createUser } = await import('../../lib/db');
    const deptId = createDepartment({ name: 'Team' });
    await createUser({ username: 'user1', password: 'pass123', departmentId: deptId });
    await createUser({ username: 'user2', password: 'pass123', departmentId: deptId });
    const members = getDepartmentMembers(deptId);
    expect(members).toHaveLength(2);
    expect(members[0]).toHaveProperty('totalCost');
    expect(members[0]).toHaveProperty('generationCount');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx vitest run src/__tests__/lib/departments.test.ts`
Expected: FAIL (departments module doesn't exist)

- [ ] **Step 3: Implement departments.ts**

Create `src/lib/departments.ts`:

```typescript
import { randomUUID } from 'crypto';
import { getDb } from './db';
import type {
  DbDepartment,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  DepartmentBudgetStatus,
  DepartmentMemberStats,
} from './db-types';

// ── CRUD ──

export function createDepartment(input: CreateDepartmentInput): string {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  const periodStart = getFirstOfMonthUTC();

  db.prepare(`
    INSERT INTO departments (id, name, description, budget_monthly, budget_warning_threshold, budget_soft_limit, budget_period_start, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.description || null,
    input.budgetMonthly ?? 0,
    input.budgetWarningThreshold ?? 0.8,
    input.budgetSoftLimit ?? 0,
    periodStart,
    now,
    now,
  );

  return id;
}

export function getDepartmentById(id: string): DbDepartment | null {
  const db = getDb();
  return db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as DbDepartment | null;
}

export function listDepartments(): DbDepartment[] {
  const db = getDb();
  return db.prepare('SELECT * FROM departments ORDER BY name').all() as DbDepartment[];
}

export function updateDepartment(id: string, updates: UpdateDepartmentInput): void {
  const db = getDb();
  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) { setClauses.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { setClauses.push('description = ?'); values.push(updates.description); }
  if (updates.budgetMonthly !== undefined) { setClauses.push('budget_monthly = ?'); values.push(updates.budgetMonthly); }
  if (updates.budgetWarningThreshold !== undefined) { setClauses.push('budget_warning_threshold = ?'); values.push(updates.budgetWarningThreshold); }
  if (updates.budgetSoftLimit !== undefined) { setClauses.push('budget_soft_limit = ?'); values.push(updates.budgetSoftLimit); }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE departments SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteDepartment(id: string): void {
  const db = getDb();
  const memberCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE department_id = ?').get(id) as { count: number };
  if (memberCount.count > 0) {
    throw new Error('Cannot delete department with active members. Reassign or remove users first.');
  }
  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
}

// ── Members ──

export function getDepartmentMembers(departmentId: string): DepartmentMemberStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      u.id as userId,
      u.username,
      u.display_name as displayName,
      u.role,
      COALESCE(SUM(ac.cost_usd), 0) as totalCost,
      COUNT(ac.id) as generationCount,
      MAX(ac.created_at) as lastActivity
    FROM users u
    LEFT JOIN api_calls ac ON ac.user_id = u.id
    WHERE u.department_id = ?
    GROUP BY u.id
    ORDER BY u.username
  `).all(departmentId) as DepartmentMemberStats[];
}

export function getDepartmentMemberCount(departmentId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM users WHERE department_id = ?').get(departmentId) as { count: number };
  return row.count;
}

// ── Budget ──

export function getDepartmentBudgetStatus(departmentId: string): DepartmentBudgetStatus | null {
  const dept = getDepartmentById(departmentId);
  if (!dept) return null;

  // Lazy reset if needed
  ensureBudgetPeriodCurrent(departmentId);
  // Re-read after potential reset
  const current = getDepartmentById(departmentId)!;

  const usageRatio = current.budget_monthly > 0 ? current.budget_used / current.budget_monthly : 0;
  const periodStart = current.budget_period_start || getFirstOfMonthUTC();
  const daysRemaining = getDaysRemainingInMonth();

  return {
    departmentId: current.id,
    departmentName: current.name,
    budgetMonthly: current.budget_monthly,
    budgetUsed: current.budget_used,
    usageRatio,
    warningThreshold: current.budget_warning_threshold,
    softLimit: current.budget_soft_limit,
    periodStart,
    daysRemainingInPeriod: daysRemaining,
    isWarning: usageRatio >= current.budget_warning_threshold,
    isExceeded: current.budget_monthly > 0 && current.budget_used >= current.budget_monthly,
  };
}

export function updateBudgetUsed(departmentId: string, costToAdd: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE departments
    SET budget_used = budget_used + ?,
        updated_at = ?
    WHERE id = ?
  `).run(costToAdd, new Date().toISOString(), departmentId);
}

export function ensureBudgetPeriodCurrent(departmentId: string): boolean {
  const db = getDb();
  const dept = db.prepare('SELECT budget_period_start FROM departments WHERE id = ?').get(departmentId) as { budget_period_start: string | null } | null;
  if (!dept) return false;

  const currentFirst = getFirstOfMonthUTC();
  if (!dept.budget_period_start || dept.budget_period_start < currentFirst) {
    db.prepare(`
      UPDATE departments
      SET budget_used = 0,
          budget_period_start = ?,
          updated_at = ?
      WHERE id = ?
    `).run(currentFirst, new Date().toISOString(), departmentId);
    return true; // Reset happened
  }
  return false;
}

// ── Helpers ──

export function getFirstOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function getDaysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return lastDay.getUTCDate() - now.getUTCDate();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx vitest run src/__tests__/lib/departments.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/departments.ts src/__tests__/lib/departments.test.ts
git commit -m "feat(departments): add department CRUD, members, and budget DB functions"
```

---

## Task 4: Budget Enforcement Logic

**Files:**
- Create: `src/lib/budget.ts`
- Test: `src/__tests__/lib/budget.test.ts` (new)

- [ ] **Step 1: Write budget pre-check tests**

Create `src/__tests__/lib/budget.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

let db: Database.Database;
let dbPath: string;

beforeEach(() => {
  dbPath = path.join('/tmp', `test-budget-${randomUUID()}.db`);
  process.env.__TEST_DB_PATH = dbPath;
});

afterEach(() => {
  try { db?.close(); } catch {}
  try { fs.unlinkSync(dbPath); } catch {}
  delete process.env.__TEST_DB_PATH;
});

describe('budget pre-check', () => {
  it('should allow generation when no department assigned', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const result = checkBudget({ departmentId: null, role: 'user', estimatedCost: 0.10 });
    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toBeUndefined();
  });

  it('should allow generation when budget is not configured (0)', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'NoBudget', budgetMonthly: 0 });
    const result = checkBudget({ departmentId: deptId, role: 'user', estimatedCost: 0.10 });
    expect(result.allowed).toBe(true);
  });

  it('should allow generation under threshold without warning', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'Healthy', budgetMonthly: 100 });
    // budget_used is 0, estimatedCost is 5 → 5% usage → no warning
    const result = checkBudget({ departmentId: deptId, role: 'user', estimatedCost: 5 });
    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toBeUndefined();
  });

  it('should return warning when at threshold', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment, updateBudgetUsed } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'Warning', budgetMonthly: 100 });
    updateBudgetUsed(deptId, 82); // 82% used
    const result = checkBudget({ departmentId: deptId, role: 'user', estimatedCost: 0.10 });
    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toContain('82%');
  });

  it('should block when budget exceeded for regular user', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment, updateBudgetUsed } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'Exceeded', budgetMonthly: 100, budgetSoftLimit: 0 });
    updateBudgetUsed(deptId, 99);
    const result = checkBudget({ departmentId: deptId, role: 'user', estimatedCost: 5 });
    expect(result.allowed).toBe(false);
    expect(result.budgetExceeded).toBe(true);
  });

  it('should allow overage within soft limit', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment, updateBudgetUsed } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'Soft', budgetMonthly: 100, budgetSoftLimit: 10 });
    updateBudgetUsed(deptId, 99);
    const result = checkBudget({ departmentId: deptId, role: 'user', estimatedCost: 5 });
    expect(result.allowed).toBe(true); // 99 + 5 = 104 ≤ 100 + 10
    expect(result.budgetWarning).toBeDefined();
  });

  it('should allow when exactly at soft limit boundary', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment, updateBudgetUsed } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'Boundary', budgetMonthly: 100, budgetSoftLimit: 10 });
    updateBudgetUsed(deptId, 95);
    // 95 + 15 = 110 = 100 + 10 → exactly at boundary, should pass (not strictly greater)
    const result = checkBudget({ departmentId: deptId, role: 'user', estimatedCost: 15 });
    expect(result.allowed).toBe(true);
  });

  it('should block when one cent over soft limit', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment, updateBudgetUsed } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'OverBoundary', budgetMonthly: 100, budgetSoftLimit: 10 });
    updateBudgetUsed(deptId, 95);
    // 95 + 15.01 = 110.01 > 110 → should block
    const result = checkBudget({ departmentId: deptId, role: 'user', estimatedCost: 15.01 });
    expect(result.allowed).toBe(false);
  });

  it('should allow admin even when budget exceeded', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment, updateBudgetUsed } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'AdminTest', budgetMonthly: 100 });
    updateBudgetUsed(deptId, 200);
    const result = checkBudget({ departmentId: deptId, role: 'admin', estimatedCost: 5 });
    expect(result.allowed).toBe(true);
  });

  it('should allow dept_admin of own dept even when budget exceeded', async () => {
    const { checkBudget } = await import('../../lib/budget');
    const { createDepartment, updateBudgetUsed } = await import('../../lib/departments');
    const deptId = createDepartment({ name: 'DeptAdminTest', budgetMonthly: 100 });
    updateBudgetUsed(deptId, 200);
    const result = checkBudget({ departmentId: deptId, role: 'dept_admin', estimatedCost: 5 });
    expect(result.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx vitest run src/__tests__/lib/budget.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement budget.ts**

Create `src/lib/budget.ts`:

```typescript
import { getDepartmentById, ensureBudgetPeriodCurrent } from './departments';

export interface BudgetCheckInput {
  departmentId: string | null;
  role: 'admin' | 'dept_admin' | 'user';
  estimatedCost: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  budgetExceeded?: boolean;
  budgetWarning?: string;
  /** Current usage info for frontend widget */
  budgetStatus?: {
    departmentName: string;
    budgetMonthly: number;
    budgetUsed: number;
    usagePercent: number;
  };
}

const DEFAULT_ESTIMATED_COST = 0.25; // Safe default if pricing unavailable

export function getEstimatedCost(cost: number | undefined | null): number {
  return (cost != null && cost > 0) ? cost : DEFAULT_ESTIMATED_COST;
}

export function checkBudget(input: BudgetCheckInput): BudgetCheckResult {
  const { departmentId, role, estimatedCost } = input;

  // Step 1-2: No department → no budget check
  if (!departmentId) {
    return { allowed: true };
  }

  // Step 3: Lazy reset
  ensureBudgetPeriodCurrent(departmentId);

  const dept = getDepartmentById(departmentId);
  if (!dept) {
    return { allowed: true }; // Department not found (shouldn't happen)
  }

  // Step 4: No budget configured
  if (dept.budget_monthly <= 0) {
    return { allowed: true };
  }

  const usageRatio = dept.budget_used / dept.budget_monthly;
  const usagePercent = Math.round(usageRatio * 100);

  const budgetStatus = {
    departmentName: dept.name,
    budgetMonthly: dept.budget_monthly,
    budgetUsed: dept.budget_used,
    usagePercent,
  };

  // Step 7-8: Admin and dept_admin bypass enforcement (but still get warnings)
  if (role === 'admin' || role === 'dept_admin') {
    const warning = usageRatio >= dept.budget_warning_threshold
      ? `Department "${dept.name}" has used ${usagePercent}% of monthly budget`
      : undefined;
    return { allowed: true, budgetWarning: warning, budgetStatus };
  }

  // Step 9: Block if strictly over limit (including soft limit)
  // Exact boundary (budget_used + cost == budget_monthly + soft_limit) is allowed
  if (dept.budget_used + estimatedCost > dept.budget_monthly + dept.budget_soft_limit) {
    return {
      allowed: false,
      budgetExceeded: true,
      budgetStatus,
    };
  }

  // Step 10: Warning if at threshold
  if (usageRatio >= dept.budget_warning_threshold) {
    return {
      allowed: true,
      budgetWarning: `Department "${dept.name}" has used ${usagePercent}% of monthly budget`,
      budgetStatus,
    };
  }

  // Step 11: All clear
  return { allowed: true, budgetStatus };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx vitest run src/__tests__/lib/budget.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/budget.ts src/__tests__/lib/budget.test.ts
git commit -m "feat(budget): add budget pre-check logic with warning and soft limit"
```

---

## Task 5: Update GenerateResponse Type

**Files:**
- Modify: `src/types/api.ts` (line 23)

- [ ] **Step 1: Add budget fields to GenerateResponse**

In `src/types/api.ts`, update the `GenerateResponse` interface:

```typescript
export interface GenerateResponse {
  success: boolean;
  image?: string;
  video?: string;
  videoUrl?: string;
  audio?: string;
  audioUrl?: string;
  model3dUrl?: string;
  contentType?: "image" | "video" | "3d" | "audio";
  error?: string;
  // Budget enforcement fields
  budgetWarning?: string;
  budgetExceeded?: boolean;
  budgetStatus?: {
    departmentName: string;
    budgetMonthly: number;
    budgetUsed: number;
    usagePercent: number;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/api.ts
git commit -m "feat(types): add budget fields to GenerateResponse"
```

---

## Task 6: Auth Middleware — RequestUser + helpers

> Note: Tasks renumbered from original (Task 5 inserted above). Old Task 5→6, 6→7, etc.

**Files:**
- Modify: `src/lib/auth/getRequestUser.ts` (lines 13-43)
- Modify: `src/app/api/auth/login/route.ts` (lines 87-115, JWT payload)
- Modify: `src/app/api/auth/me/route.ts` (lines 4-18)

- [ ] **Step 1: Update RequestUser interface and add helpers**

In `src/lib/auth/getRequestUser.ts`, replace the entire file:

```typescript
import { verifyToken } from './jwt';
import { NextRequest } from 'next/server';

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface RequestUser {
  userId: string;
  username: string;
  role: 'admin' | 'dept_admin' | 'user';
  departmentId: string | null;
  departmentName: string | null;
}

export async function getRequestUser(req: NextRequest): Promise<RequestUser> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) throw new AuthError(401, 'Not authenticated');

  const payload = await verifyToken(token);
  if (!payload || !payload.authenticated || !payload.userId) {
    throw new AuthError(401, 'Invalid session');
  }

  return {
    userId: payload.userId as string,
    username: payload.username as string,
    role: (payload.role as RequestUser['role']) || 'user',
    departmentId: (payload.departmentId as string) || null,
    departmentName: (payload.departmentName as string) || null,
  };
}

export async function requireAdmin(req: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role !== 'admin') {
    throw new AuthError(403, 'Admin access required');
  }
  return user;
}

export async function requireDeptAdmin(req: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role !== 'admin' && user.role !== 'dept_admin') {
    throw new AuthError(403, 'Department admin access required');
  }
  return user;
}

export async function requireDepartmentAccess(req: NextRequest, departmentId: string): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role === 'admin') return user; // Admin sees all
  if (user.departmentId === departmentId) return user; // Same department
  throw new AuthError(403, 'Access denied to this department');
}
```

- [ ] **Step 2: Update login route to include department info in JWT**

In `src/app/api/auth/login/route.ts`, after successful DB authentication (around line 90-94), look up the user's department before signing the token. Replace the JWT signing section:

```typescript
// After const dbUser = await authenticateUser(username, password);
// Look up department info
let departmentId: string | null = null;
let departmentName: string | null = null;
if (dbUser.department_id) {
  const { getDepartmentById } = await import('@/lib/departments');
  const dept = getDepartmentById(dbUser.department_id);
  if (dept) {
    departmentId = dept.id;
    departmentName = dept.name;
  }
}

const token = await signToken({
  authenticated: true,
  username: dbUser.username,
  userId: dbUser.id,
  role: dbUser.role,
  departmentId,
  departmentName,
});
```

Apply the same pattern for the ENV fallback auth path (around line 158).

- [ ] **Step 3: Update /api/auth/me to return department info**

In `src/app/api/auth/me/route.ts`, update the response:

```typescript
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    return NextResponse.json({
      userId: user.userId,
      username: user.username,
      role: user.role,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/getRequestUser.ts src/app/api/auth/login/route.ts src/app/api/auth/me/route.ts
git commit -m "feat(auth): extend RequestUser with department, add requireDeptAdmin/requireDepartmentAccess"
```

---

## Task 6: Department API Routes

**Files:**
- Create: `src/app/api/admin/departments/route.ts`
- Create: `src/app/api/admin/departments/[id]/route.ts`
- Create: `src/app/api/admin/departments/[id]/members/route.ts`
- Create: `src/app/api/admin/departments/[id]/budget/route.ts`

- [ ] **Step 1: Create departments list/create route**

Create `src/app/api/admin/departments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, requireDeptAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { createDepartment, listDepartments, getDepartmentById, getDepartmentMemberCount } from '@/lib/departments';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (user.role === 'admin') {
      const departments = listDepartments();
      const withCounts = departments.map(d => ({
        ...d,
        memberCount: getDepartmentMemberCount(d.id),
      }));
      return NextResponse.json({ departments: withCounts });
    }

    if (user.role === 'dept_admin' && user.departmentId) {
      const dept = getDepartmentById(user.departmentId);
      if (!dept) return NextResponse.json({ departments: [] });
      return NextResponse.json({
        departments: [{
          ...dept,
          memberCount: getDepartmentMemberCount(dept.id),
        }],
      });
    }

    return NextResponse.json({ departments: [] });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only global admin can create departments' }, { status: 403 });
    }

    const { name, description, budgetMonthly, budgetWarningThreshold, budgetSoftLimit } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    try {
      const id = createDepartment({ name: name.trim(), description, budgetMonthly, budgetWarningThreshold, budgetSoftLimit });
      return NextResponse.json({ departmentId: id }, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create single department route (GET/PUT/DELETE)**

Create `src/app/api/admin/departments/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentById, updateDepartment, deleteDepartment, getDepartmentMemberCount } from '@/lib/departments';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireDepartmentAccess(req, id);
    const dept = getDepartmentById(id);
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    return NextResponse.json({ department: { ...dept, memberCount: getDepartmentMemberCount(id) } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireDepartmentAccess(req, id);
    // dept_admin can update own dept, admin can update any
    if (user.role !== 'admin' && user.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    const body = await req.json();
    updateDepartment(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireDepartmentAccess(req, id);
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only global admin can delete departments' }, { status: 403 });
    }
    deleteDepartment(id); // Throws if has members
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Error && error.message.includes('active members')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create members route**

Create `src/app/api/admin/departments/[id]/members/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentMembers } from '@/lib/departments';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireDepartmentAccess(req, id);
    if (user.role === 'user') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const members = getDepartmentMembers(id);
    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create budget status route**

Create `src/app/api/admin/departments/[id]/budget/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentBudgetStatus } from '@/lib/departments';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireDepartmentAccess(req, id);
    const status = getDepartmentBudgetStatus(id);
    if (!status) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    return NextResponse.json({ budget: status });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/departments/
git commit -m "feat(api): add department CRUD, members, and budget status routes"
```

---

## Task 7: Modify Existing User Routes for Department Support

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Update user list/create route**

In `src/app/api/admin/users/route.ts`, replace the GET handler to scope by department for dept_admin, and update POST to accept `departmentId`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { listUsers, createUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (user.role !== 'admin' && user.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    let users = listUsers();

    // dept_admin sees only own department
    if (user.role === 'dept_admin' && user.departmentId) {
      users = users.filter(u => u.department_id === user.departmentId);
    }

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (user.role !== 'admin' && user.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { username, password, displayName, role, departmentId } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // dept_admin can only create users in own department
    if (user.role === 'dept_admin') {
      if (role === 'admin') {
        return NextResponse.json({ error: 'Cannot create admin users' }, { status: 403 });
      }
      // Force new user into dept_admin's department
      const userId = await createUser({
        username,
        password,
        displayName: displayName || username,
        role: role || 'user',
        departmentId: user.departmentId || undefined,
      });
      return NextResponse.json({ userId }, { status: 201 });
    }

    // Global admin can create in any department
    try {
      const userId = await createUser({
        username,
        password,
        displayName: displayName || username,
        role: role || 'user',
        departmentId,
      });
      return NextResponse.json({ userId }, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update user edit/delete route**

In `src/app/api/admin/users/[id]/route.ts`, update PUT to support `departmentId` and scope dept_admin access:

Add at the top of PUT handler, after `requireAdmin` → change to check for dept_admin access:

```typescript
// Replace requireAdmin with:
const admin = await getRequestUser(req);
if (admin.role !== 'admin' && admin.role !== 'dept_admin') {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}

const { id } = await params;
const { displayName, role, newPassword, departmentId } = await req.json();

// dept_admin scope checks
if (admin.role === 'dept_admin') {
  const targetUser = getUserById(id);
  if (!targetUser || targetUser.department_id !== admin.departmentId) {
    return NextResponse.json({ error: 'Can only edit users in your department' }, { status: 403 });
  }
  if (role === 'admin') {
    return NextResponse.json({ error: 'Cannot promote to admin' }, { status: 403 });
  }
}

// Build updates
if (displayName !== undefined || role !== undefined || departmentId !== undefined) {
  updateUser(id, {
    display_name: displayName,
    role,
    department_id: departmentId,
  });
}
```

Apply similar scope check in DELETE handler.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/users/route.ts src/app/api/admin/users/[id]/route.ts
git commit -m "feat(api): add department support to user CRUD routes"
```

---

## Task 8: Budget Enforcement in Generate Route

**Files:**
- Modify: `src/app/api/generate/route.ts` (line ~89, after auth check)
- Modify: `src/lib/db.ts` (lines 616-687, `insertGenerationWithCall`)

- [ ] **Step 1: Add budget pre-check to generate route**

In `src/app/api/generate/route.ts`, after line 94 (`const user = await getRequestUser(request);`), add the budget pre-check:

```typescript
    // ── Budget pre-check ──
    const { checkBudget, getEstimatedCost } = await import('@/lib/budget');
    const { getUserById } = await import('@/lib/db');

    const dbUser = getUserById(user.userId);
    const departmentId = dbUser?.department_id || null;

    // Estimate cost from model pricing (rough estimate for pre-check)
    const estimatedCost = getEstimatedCost(
      selectedModel?.pricing?.perGeneration ?? null
    );

    const budgetResult = checkBudget({
      departmentId,
      role: user.role,
      estimatedCost,
    });

    if (!budgetResult.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Department budget exceeded. Contact your department admin.',
        budgetExceeded: true,
        budgetStatus: budgetResult.budgetStatus,
      }, { status: 403 });
    }
    // Store for post-generation response
    const budgetWarning = budgetResult.budgetWarning;
    const budgetStatus = budgetResult.budgetStatus;
```

- [ ] **Step 2: Update insertGenerationWithCall to update department budget**

In `src/lib/db.ts`, inside the `insertGenerationWithCall` transaction (line ~616), after inserting the API call, add the budget update:

```typescript
    // Inside the transaction, after api_calls INSERT:
    // Update department budget if user has a department
    if (generationInput.userId) {
      const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(generationInput.userId) as { department_id: string | null } | undefined;
      if (user?.department_id) {
        db.prepare(`
          UPDATE departments
          SET budget_used = budget_used + ?,
              updated_at = ?
          WHERE id = ?
        `).run(apiCallInput.costUsd || 0, new Date().toISOString(), user.department_id);
      }
    }
```

- [ ] **Step 3: Add budgetWarning to successful responses in generate route**

At each `buildMediaResponse()` call site in the generate route, inject budgetWarning into the response. Find the return statements and wrap them:

```typescript
    // Before returning response, inject budget info
    const response = buildMediaResponse(output);
    if (budgetWarning || budgetStatus) {
      const body = await response.json();
      return NextResponse.json({
        ...body,
        budgetWarning,
        budgetStatus,
      });
    }
    return response;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/generate/route.ts src/lib/db.ts
git commit -m "feat(budget): add budget pre-check to generate route, update budget on generation"
```

---

## Task 9: Frontend — Zustand Auth Slice Update

**Files:**
- Modify: `src/store/slices/authSlice.ts` (lines 10-14)

- [ ] **Step 1: Extend CurrentUser interface**

In `src/store/slices/authSlice.ts`, update:

```typescript
export interface CurrentUser {
  userId: string;
  username: string;
  role: "admin" | "dept_admin" | "user";
  departmentId: string | null;
  departmentName: string | null;
}
```

- [ ] **Step 2: Update fetchCurrentUser to include new fields**

In the `fetchCurrentUser` implementation, ensure the response mapping includes:

```typescript
set({
  currentUser: {
    userId: data.userId,
    username: data.username,
    role: data.role,
    departmentId: data.departmentId || null,
    departmentName: data.departmentName || null,
  },
  isAuthLoading: false,
});
```

- [ ] **Step 3: Commit**

```bash
git add src/store/slices/authSlice.ts
git commit -m "feat(store): extend CurrentUser with department fields"
```

---

## Task 10: Frontend — Admin Panel Department Tab

**Files:**
- Create: `src/components/admin/AdminDepartmentList.tsx`
- Create: `src/components/admin/AdminDepartmentForm.tsx`
- Create: `src/components/admin/AdminDepartmentMembers.tsx`
- Modify: `src/components/admin/AdminPanel.tsx`
- Modify: `src/components/admin/AdminUserForm.tsx`
- Modify: `src/components/admin/AdminUserList.tsx`

- [ ] **Step 1: Create AdminDepartmentList component**

Create `src/components/admin/AdminDepartmentList.tsx` — a list of departments with name, member count, and budget progress bar. Follow the same patterns as `AdminUserList.tsx`. Each row shows: department name, member count, budget bar (colored green/yellow/red based on usage), and edit/delete action buttons.

Key features:
- Fetch departments from `GET /api/admin/departments`
- Budget bar: `(budget_used / budget_monthly) * 100` as width percentage
- Color: green if < threshold, yellow if ≥ threshold, red if ≥ 100%
- Click row to expand and show members (lazy-loads from `/api/admin/departments/[id]/members`)
- Create button (admin only) → opens `AdminDepartmentForm`

- [ ] **Step 2: Create AdminDepartmentForm component**

Create `src/components/admin/AdminDepartmentForm.tsx` — form with fields: name, description, budgetMonthly, budgetWarningThreshold (0-100 displayed as percentage), budgetSoftLimit. Follow `AdminUserForm.tsx` patterns. POST to `/api/admin/departments` for create, PUT to `/api/admin/departments/[id]` for edit.

- [ ] **Step 3: Create AdminDepartmentMembers component**

Create `src/components/admin/AdminDepartmentMembers.tsx` — table of department members with username, display_name, role, total spend, generation count, last activity. Fetches from `GET /api/admin/departments/[id]/members`.

- [ ] **Step 4: Update AdminPanel to add Departments tab**

In `src/components/admin/AdminPanel.tsx`, add a third tab "departments" (visible only to admin global). Update `activeTab` type to `"users" | "stats" | "departments"`. Add `renderDepartmentsTab()` that renders `AdminDepartmentList`.

For `dept_admin` role: show only "users" and "stats" tabs (no departments tab since they manage via user list).

- [ ] **Step 5: Update AdminUserList to show department column**

In `src/components/admin/AdminUserList.tsx`, add a "Department" column showing the user's department name. If the user has no department, show "—".

- [ ] **Step 6: Update AdminUserForm to include department and dept_admin role**

In `src/components/admin/AdminUserForm.tsx`:
- Add a department dropdown (fetched from `GET /api/admin/departments`) — only visible to admin global
- Add `dept_admin` to the role select options
- When dept_admin is creating a user, hide the department dropdown (auto-assigned)

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/AdminDepartmentList.tsx src/components/admin/AdminDepartmentForm.tsx src/components/admin/AdminDepartmentMembers.tsx src/components/admin/AdminPanel.tsx src/components/admin/AdminUserList.tsx src/components/admin/AdminUserForm.tsx
git commit -m "feat(ui): add department management tab and update user forms"
```

---

## Task 11: Frontend — Budget Widget

**Files:**
- Create: `src/components/BudgetWidget.tsx`
- Modify: canvas toolbar component (find the toolbar in `src/components/WorkflowCanvas.tsx` or related toolbar component)

- [ ] **Step 1: Create BudgetWidget component**

Create `src/components/BudgetWidget.tsx`:

```typescript
// Compact budget indicator for canvas toolbar
// Shows: thin progress bar with color coding
//   - Green: under warning threshold
//   - Yellow: at/above warning threshold
//   - Red: at/over budget
// Click to expand: department name, used/total, %, days remaining
// Fetches from GET /api/admin/departments/[id]/budget using currentUser.departmentId
// Only renders if user has a department with budget > 0
```

Component pattern:
- Uses `useWorkflowStore()` to get `currentUser` from auth slice
- Fetches budget status on mount and after each generation
- Renders a ~120px wide bar in the toolbar area
- Click/hover expands a small popover with full details
- Uses CSS vars for theming consistency (`var(--accent)`, `var(--surface-1)`, etc.)

- [ ] **Step 2: Integrate BudgetWidget into canvas toolbar**

Find the toolbar area in the canvas components and add `<BudgetWidget />` next to existing controls.

- [ ] **Step 3: Add budget warning/exceeded toast handling**

In the generation response handler (wherever `buildMediaResponse` results are consumed on the frontend), check for `budgetWarning` and `budgetExceeded` fields:

```typescript
if (response.budgetExceeded) {
  useToast().addToast({
    type: 'error',
    message: 'Department budget exceeded. Contact your department admin.',
  });
}
if (response.budgetWarning) {
  useToast().addToast({
    type: 'warning',
    message: response.budgetWarning,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/BudgetWidget.tsx
git commit -m "feat(ui): add budget widget to canvas toolbar with warning toasts"
```

---

## Task 12: Integration Testing & Verification

**Files:**
- All previously created/modified files

- [ ] **Step 1: Run full test suite**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 2: Run TypeScript type check**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run linter**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npm run lint`
Expected: No errors

- [ ] **Step 4: Build verification**

Run: `cd /sessions/exciting-compassionate-wright/mnt/app && npm run build`
Expected: Successful build

- [ ] **Step 5: Manual verification checklist**

Start the dev server (`npm run dev`) and verify:
- [ ] Login as admin → AdminPanel shows 3 tabs (Departments, Users, Stats)
- [ ] Create a department "Design" with $100 budget
- [ ] Create a user in "Design" department with `dept_admin` role
- [ ] Create a regular user in "Design" department
- [ ] Login as dept_admin → AdminPanel shows Users and Stats (own department only)
- [ ] dept_admin can create new users (auto-assigned to department)
- [ ] Login as regular user → No admin access, budget widget visible
- [ ] Generate an image → budget_used increases, widget updates
- [ ] At 80% budget → yellow warning toast appears
- [ ] At 100% budget → regular user blocked, dept_admin can still generate
- [ ] Admin can generate regardless of budget

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration testing fixes"
```
