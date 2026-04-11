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
    id, input.name, input.description || null,
    input.budgetMonthly ?? 0, input.budgetWarningThreshold ?? 0.8, input.budgetSoftLimit ?? 0,
    periodStart, now, now,
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
  ensureBudgetPeriodCurrent(departmentId);
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
    UPDATE departments SET budget_used = budget_used + ?, updated_at = ? WHERE id = ?
  `).run(costToAdd, new Date().toISOString(), departmentId);
}

export function ensureBudgetPeriodCurrent(departmentId: string): boolean {
  const db = getDb();
  const dept = db.prepare('SELECT budget_period_start FROM departments WHERE id = ?').get(departmentId) as { budget_period_start: string | null } | null;
  if (!dept) return false;
  const currentFirst = getFirstOfMonthUTC();
  if (!dept.budget_period_start || dept.budget_period_start < currentFirst) {
    db.prepare(`
      UPDATE departments SET budget_used = 0, budget_period_start = ?, updated_at = ? WHERE id = ?
    `).run(currentFirst, new Date().toISOString(), departmentId);
    return true;
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
