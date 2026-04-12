import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import type {
  DbDepartment,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  DepartmentBudgetStatus,
  DepartmentMemberStats,
} from './db-types';

/**
 * Create a new department with initial budget settings.
 */
export function createDepartment(input: CreateDepartmentInput): string {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const firstOfMonth = getFirstOfMonthUTC();

  const stmt = db.prepare(`
    INSERT INTO departments (id, name, description, budget_monthly, budget_warning_threshold, budget_soft_limit, budget_used, budget_period_start, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.name,
    input.description || null,
    input.budgetMonthly || 0,
    input.budgetWarningThreshold || 0.8,
    input.budgetSoftLimit || 0,
    0,
    firstOfMonth,
    now,
    now
  );

  return id;
}

/**
 * Get a department by ID.
 */
export function getDepartmentById(id: string): DbDepartment | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM departments WHERE id = ? LIMIT 1');
  const dept = stmt.get(id) as DbDepartment | undefined;
  return dept || null;
}

/**
 * List all departments.
 */
export function listDepartments(): DbDepartment[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM departments ORDER BY created_at DESC');
  return stmt.all() as DbDepartment[];
}

/**
 * Update department fields. Only provided fields are updated.
 */
export function updateDepartment(id: string, input: UpdateDepartmentInput): void {
  const db = getDb();
  const now = new Date().toISOString();

  // Build dynamic update query
  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }
  if (input.budgetMonthly !== undefined) {
    updates.push('budget_monthly = ?');
    values.push(input.budgetMonthly);
  }
  if (input.budgetWarningThreshold !== undefined) {
    updates.push('budget_warning_threshold = ?');
    values.push(input.budgetWarningThreshold);
  }
  if (input.budgetSoftLimit !== undefined) {
    updates.push('budget_soft_limit = ?');
    values.push(input.budgetSoftLimit);
  }

  if (updates.length === 0) {
    return; // Nothing to update
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const sql = `UPDATE departments SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...values);
}

/**
 * Delete a department. Fails if department has active members (users).
 */
export function deleteDepartment(id: string): void {
  const db = getDb();

  // Check if department has any members
  const memberCount = db
    .prepare('SELECT COUNT(*) as count FROM users WHERE department_id = ?')
    .get(id) as { count: number };

  if (memberCount.count > 0) {
    throw new Error(`Cannot delete department with active members (${memberCount.count} users)`);
  }

  db.prepare('DELETE FROM departments WHERE id = ?').run(id);
}

/**
 * Get all members of a department with stats.
 */
export function getDepartmentMembers(departmentId: string): DepartmentMemberStats[] {
  const db = getDb();

  const stmt = db.prepare(`
    SELECT
      u.id as userId,
      u.username,
      u.display_name as displayName,
      u.role,
      COALESCE(SUM(g.cost_usd), 0) as totalCost,
      COUNT(g.id) as generationCount,
      MAX(g.created_at) as lastActivity
    FROM users u
    LEFT JOIN generations g ON u.id = g.user_id AND g.is_deleted = 0
    WHERE u.department_id = ?
    GROUP BY u.id, u.username, u.display_name, u.role
    ORDER BY u.created_at DESC
  `);

  const rows = stmt.all(departmentId) as any[];
  return rows.map(row => ({
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    totalCost: row.totalCost,
    generationCount: row.generationCount,
    lastActivity: row.lastActivity,
  }));
}

/**
 * Get count of members in a department.
 */
export function getDepartmentMemberCount(departmentId: string): number {
  const db = getDb();
  const result = db
    .prepare('SELECT COUNT(*) as count FROM users WHERE department_id = ?')
    .get(departmentId) as { count: number };
  return result.count;
}

/**
 * Get budget status for a department.
 */
export function getDepartmentBudgetStatus(departmentId: string): DepartmentBudgetStatus {
  const db = getDb();

  const dept = db
    .prepare('SELECT * FROM departments WHERE id = ? LIMIT 1')
    .get(departmentId) as DbDepartment | undefined;

  if (!dept) {
    throw new Error(`Department not found: ${departmentId}`);
  }

  // Calculate days remaining in current period
  const periodStart = new Date(dept.budget_period_start);
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const usageRatio = dept.budget_monthly > 0 ? dept.budget_used / dept.budget_monthly : 0;
  const isWarning = usageRatio >= dept.budget_warning_threshold;
  const isExceeded = dept.budget_used > dept.budget_monthly + dept.budget_soft_limit;

  return {
    departmentId: dept.id,
    departmentName: dept.name,
    budgetMonthly: dept.budget_monthly,
    budgetUsed: dept.budget_used,
    usageRatio,
    warningThreshold: dept.budget_warning_threshold,
    softLimit: dept.budget_soft_limit,
    periodStart: dept.budget_period_start,
    daysRemainingInPeriod: daysRemaining,
    isWarning,
    isExceeded,
  };
}

/**
 * Update budget used for a department (add cost).
 */
export function updateBudgetUsed(departmentId: string, costToAdd: number): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE departments
    SET budget_used = budget_used + ?, updated_at = ?
    WHERE id = ?
  `).run(costToAdd, now, departmentId);
}

/**
 * Ensure the budget period is current (reset if monthly boundary crossed).
 * Returns true if reset occurred.
 */
export function ensureBudgetPeriodCurrent(departmentId: string): boolean {
  const db = getDb();
  const currentFirst = getFirstOfMonthUTC();
  const now = new Date().toISOString();

  const result = db.prepare(`
    UPDATE departments
    SET budget_used = 0, budget_period_start = ?, updated_at = ?
    WHERE id = ? AND (budget_period_start IS NULL OR budget_period_start < ?)
  `).run(currentFirst, now, departmentId, currentFirst);

  return result.changes > 0;
}

/**
 * Get the first day of the current month in UTC as ISO date string.
 */
export function getFirstOfMonthUTC(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  return first.toISOString().split('T')[0] + 'T00:00:00Z';
}
