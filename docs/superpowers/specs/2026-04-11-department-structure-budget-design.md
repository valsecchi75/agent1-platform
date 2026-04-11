# Department Structure & Budget Management

**Date:** 2026-04-11
**Status:** Approved
**Author:** Claude + Sergio

---

## Overview

Extend AGENT 1's user system from a flat admin/user model to a three-tier organizational structure with departments, department admins, and per-department budget enforcement. Each user belongs to exactly one department. Budgets are shared pools with monthly auto-reset, progressive warnings, and soft limits.

## Requirements

- Three roles: `admin` (global), `dept_admin` (department), `user`
- One department per user (single membership)
- Shared budget pool per department with individual consumption analytics
- Monthly automatic budget reset (lazy, no external cron)
- Warning at configurable threshold (default 80%) + hard block at 100% with optional soft limit
- Admin dept exempt from budget block; admin global always exempt
- Admin dept has full powers: view team content, create/remove users, manage budget
- Admin global sees and manages everything
- Regular user sees only their own content
- Works identically on local and Azure deployments (SQLite-based)

## 1. Database Schema

### New table: `departments`

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | UUID |
| `name` | TEXT UNIQUE NOT NULL | Department name (e.g. "Design", "Marketing") |
| `description` | TEXT | Optional description |
| `budget_monthly` | REAL DEFAULT 0 | Monthly budget in USD set by admin |
| `budget_used` | REAL DEFAULT 0 | Accumulated spend in current period |
| `budget_period_start` | TEXT | ISO 8601 date of current period start (1st of month) |
| `budget_warning_threshold` | REAL DEFAULT 0.8 | Percentage at which warning triggers (0.0-1.0) |
| `budget_soft_limit` | REAL DEFAULT 0 | USD overage allowed beyond 100% (0 = hard block) |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

### Modified table: `users`

| Change | Details |
|--------|---------|
| `role` values | `'admin'`, `'dept_admin'`, `'user'` (was: `'admin'`, `'user'`) |
| `role` CHECK constraint | Must be removed — current schema has `CHECK(role IN ('admin', 'user'))` which blocks `dept_admin`. See migration section for approach. |
| New column: `department_id` | TEXT, REFERENCES departments(id), nullable |

The relationship is 1:N (one department, many users). No join table needed.

### Cost tracking

Existing `api_calls` table (with `user_id` and `cost_usd`) is unchanged. Department spend is derived via JOIN `api_calls -> users -> departments` for analytics. The `budget_used` field on `departments` serves as a denormalized cache updated atomically on each generation to avoid recalculation.

## 2. Role & Permission Matrix

| Capability | `admin` | `dept_admin` | `user` |
|------------|---------|--------------|--------|
| View all departments | Yes | No (own only) | No |
| Create/delete departments | Yes | No | No |
| Create users (any dept) | Yes | No | No |
| Create users (own dept) | Yes | Yes | No |
| Remove users (own dept) | Yes | Yes | No |
| Move users between depts | Yes | No | No |
| Set department budget | Yes | Yes (own) | No |
| View team content (own dept) | Yes | Yes | No |
| View all content (all depts) | Yes | No | No |
| View own content only | Yes | Yes | Yes |
| Promote to `admin` | Yes | No | No |
| Promote to `dept_admin` (own dept) | Yes | Yes | No |
| Bypass budget block | Yes | Yes (own dept) | No |
| View dept budget status | Yes | Yes (own) | Yes (own dept, read-only) |

## 3. Budget Enforcement

### Pre-check flow

Executed before every API generation call (in `/api/generate` route):

1. Resolve user's department via `department_id`
2. If user has no department (`department_id = NULL`): no budget check, proceed normally
3. Lazy reset: if `budget_period_start` is in a previous month, set `budget_used = 0` and `budget_period_start` to 1st of current month
4. If `budget_monthly = 0`: no budget configured, proceed normally
5. Calculate `usage_ratio = budget_used / budget_monthly`
6. Estimate generation cost via `calculatePredictedCost()` from `src/utils/costCalculator.ts`, using the selected model's pricing from the providers registry. If pricing is unavailable for the model, assume a safe default of `$0.25` (max single-generation cost across known models)
7. If user role is `admin`: skip enforcement entirely, proceed (but still return warning info)
8. If user role is `dept_admin` and department matches their own: skip enforcement, proceed (but still return warning info). If generating on behalf of another department, enforcement applies normally
9. If `budget_used + estimated_cost > budget_monthly + budget_soft_limit`: block with `403` and `{ budgetExceeded: true }`
10. If `usage_ratio >= budget_warning_threshold`: proceed but include `{ budgetWarning: "Department X has used Y% of monthly budget" }`
11. Otherwise: proceed normally

### Concurrency note

With concurrent requests from the same department, two requests may both pass the pre-check before either updates `budget_used`, potentially causing a slight budget overshoot. This is a known and accepted limitation of the lazy pre-check model. The soft limit provides a buffer for this scenario. Since `better-sqlite3` serializes writes (single writer), the post-generation `budget_used` update itself is atomic and consistent — the overshoot is bounded to the cost of one concurrent generation at most.

### Post-generation update

After successful API response, within the same DB transaction as `insertGenerationWithCall()`:

```sql
UPDATE departments
SET budget_used = budget_used + :actual_cost,
    updated_at = :now
WHERE id = :department_id
```

### Monthly reset (lazy)

No external cron. On every pre-check, if `budget_period_start` < first day of current month (UTC):

```sql
UPDATE departments
SET budget_used = 0,
    budget_period_start = :first_of_current_month_utc,
    updated_at = :now
WHERE id = :department_id
```

All budget period dates use UTC to avoid timezone ambiguity. Budget resets on the 1st of each UTC month at 00:00:00 UTC.

## 4. API Routes

### New routes

| Route | Methods | Access | Purpose |
|-------|---------|--------|---------|
| `/api/admin/departments` | GET, POST | admin (all), dept_admin (GET own) | List/create departments |
| `/api/admin/departments/[id]` | GET, PUT, DELETE | admin, dept_admin (own, no DELETE) | Detail, update, delete department |
| `/api/admin/departments/[id]/members` | GET | admin, dept_admin (own) | List members with individual spend stats |
| `/api/admin/departments/[id]/budget` | GET | admin, dept_admin (own), user (own dept) | Budget status: monthly, used, percentage, days remaining |

### Modified routes

| Route | Change |
|-------|--------|
| `POST /api/admin/users` | Add `department_id` field. Dept admin creates users in own dept only |
| `PUT /api/admin/users/[id]` | Add `department_id` and `dept_admin` role option. Dept admin restricted to own dept members, cannot promote to `admin` |
| `POST /api/generate` | Add budget pre-check before API call. Update `budget_used` post-generation. Return `budgetWarning` or `budgetExceeded` in response |
| `POST /api/auth/login` | Include `departmentId` and `departmentName` in JWT payload |
| `GET /api/auth/me` | Include `departmentId` and `departmentName` in response |

### Updated RequestUser type

In `src/lib/auth/getRequestUser.ts`, extend the `RequestUser` interface:

```typescript
export interface RequestUser {
  userId: string;
  username: string;
  role: 'admin' | 'dept_admin' | 'user';
  departmentId: string | null;
  departmentName: string | null;
}
```

`getRequestUser()` must extract `departmentId` and `departmentName` from the JWT payload.

### New middleware helpers

In `src/lib/auth/getRequestUser.ts`:

- `requireDeptAdmin(req)` — requires `dept_admin` or `admin` role, throws 403 otherwise
- `requireDepartmentAccess(req, deptId)` — verifies user is admin global OR (dept_admin/user belonging to the specified department), throws 403 otherwise

## 5. Frontend UI

### Zustand auth slice extension

`currentUser` gains `departmentId: string | null` and `departmentName: string | null`.

### Admin Panel changes

Three tabs (was two):

1. **Departments** (new, admin global only): list with name, member count, budget bar (used/total), CRUD actions. Click row expands to member list with individual spend.
2. **Users** (modified): new "Department" column, department dropdown in create/edit form, `dept_admin` role option. Dept admin sees only own department's users.
3. **Stats** (modified): admin global gets per-department aggregation. Dept admin sees own department breakdown by member.

### Budget widget (canvas)

Compact indicator in the toolbar/statusbar area. Shows department budget consumption as a thin progress bar: green (under threshold), yellow (warning zone), red (at/over limit). Click expands to show: department name, budget used / total, percentage, days remaining in period. Visible to all roles (including regular users) for their own department.

### Toast notifications

- `budgetWarning` in API response: yellow toast with percentage message
- `budgetExceeded` in API response: red toast, Run button disabled until refresh confirms budget availability

## 6. Migration & Backward Compatibility

### DB migration

Executed in `db.ts` initialization (same pattern as existing tables):

1. `CREATE TABLE IF NOT EXISTS departments (...)`
2. `ALTER TABLE users ADD COLUMN department_id TEXT REFERENCES departments(id)` — wrapped in try/catch (fails silently if column exists)
3. **Role CHECK constraint removal**: The current schema has `CHECK(role IN ('admin', 'user'))` which blocks `dept_admin`. SQLite does not support `ALTER TABLE ... DROP CONSTRAINT`. The migration must recreate the users table:
   - Create `users_new` with the updated CHECK: `CHECK(role IN ('admin', 'dept_admin', 'user'))`
   - Copy all data from `users` to `users_new`
   - Drop `users`
   - Rename `users_new` to `users`
   - Recreate indexes
   - All wrapped in a single transaction for atomicity
4. **DELETE department guard**: Deleting a department that has members returns `409 Conflict` with message "Cannot delete department with active members. Reassign or remove users first."

### Existing users

Users with `department_id = NULL` behave exactly as today: no budget constraints, see only own content. Admin global can assign them to departments at any time. Zero disruption to existing installations.

### Existing JWT tokens

Tokens without `departmentId` in payload are treated as "unassigned user". Full functionality until next login, when token is re-created with the new fields.

**Known limitation**: `departmentName` in JWT is cached at login time. If a department is renamed, users see the old name until their next login. This is a minor UX issue, not a security concern.

### File storage

No changes. Files remain at `storage/users/{userId}/`. Department grouping is purely logical (via DB), not physical in the filesystem. Zero file migration needed.

## 7. Testing Strategy

### Unit tests (Vitest)

- DB functions: department CRUD, user-department assignment, `budget_used` update, lazy monthly reset, boundary conditions (budget_used can't go negative)
- Budget enforcement logic: user under threshold, at warning, at limit, over soft limit. Admin/dept_admin bypass verification
- Middleware helpers: `requireDeptAdmin` accepts correct roles, rejects `user`. `requireDepartmentAccess` validates department membership

### API route tests

- Department CRUD: create, update, delete (blocked if has members), list filtered by role
- User creation with `department_id`: dept admin restricted to own department
- Generation with budget: response includes `budgetWarning` / `budgetExceeded` at correct thresholds

### Migration tests

- DB with no `department_id` column migrates correctly without data loss
- Users with `department_id = NULL` function normally
- JWT without `departmentId` handled gracefully

### Manual verification

Login as each of the three roles and confirm visibility boundaries: admin sees everything, dept_admin sees own department, user sees only own content.
