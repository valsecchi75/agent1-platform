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
  budgetStatus?: {
    departmentName: string;
    budgetMonthly: number;
    budgetUsed: number;
    usagePercent: number;
  };
}

const DEFAULT_ESTIMATED_COST = 0.25;

/**
 * Get the estimated cost, with fallback to default
 */
export function getEstimatedCost(cost: number | undefined | null): number {
  if (typeof cost === 'number' && cost > 0) {
    return cost;
  }
  return DEFAULT_ESTIMATED_COST;
}

/**
 * Check if a generation is allowed based on budget constraints
 *
 * - Admins: Always allowed, but may get warnings
 * - Dept admins: Always allowed, but may get warnings
 * - Regular users: Blocked if department budget exceeded
 */
export function checkBudget(input: BudgetCheckInput): BudgetCheckResult {
  const { departmentId, role, estimatedCost } = input;

  // Admins bypass enforcement but get warnings
  if (role === 'admin') {
    return { allowed: true };
  }

  // No department assigned = no constraint
  if (!departmentId) {
    return { allowed: true };
  }

  const dept = getDepartmentById(departmentId);
  if (!dept) {
    return { allowed: true };
  }

  // Ensure period is current
  ensureBudgetPeriodCurrent(departmentId);

  // Re-fetch to get updated values
  const updatedDept = getDepartmentById(departmentId);
  if (!updatedDept) {
    return { allowed: true };
  }

  const totalWouldBe = updatedDept.budget_used + estimatedCost;
  const limit = updatedDept.budget_monthly + updatedDept.budget_soft_limit;
  const budgetExceeded = totalWouldBe > limit;

  const usagePercent =
    updatedDept.budget_monthly > 0
      ? (updatedDept.budget_used / updatedDept.budget_monthly) * 100
      : 0;

  const status = {
    departmentName: updatedDept.name,
    budgetMonthly: updatedDept.budget_monthly,
    budgetUsed: updatedDept.budget_used,
    usagePercent: Math.round(usagePercent * 100) / 100,
  };

  // Dept admins always allowed, but get warnings
  if (role === 'dept_admin') {
    return {
      allowed: true,
      budgetExceeded: budgetExceeded || false,
      budgetWarning: budgetExceeded
        ? `Department budget would be exceeded: $${updatedDept.budget_used.toFixed(2)} + $${estimatedCost.toFixed(2)} > $${limit.toFixed(2)}`
        : undefined,
      budgetStatus: status,
    };
  }

  // Regular users: blocked if budget exceeded
  if (budgetExceeded) {
    return {
      allowed: false,
      budgetExceeded: true,
      budgetWarning: `Department budget exceeded. Current usage: $${updatedDept.budget_used.toFixed(2)}/${updatedDept.budget_monthly.toFixed(2)} (${usagePercent.toFixed(1)}%)`,
      budgetStatus: status,
    };
  }

  // User is within budget, but check if warning threshold reached
  const isWarning =
    updatedDept.budget_monthly > 0 &&
    updatedDept.budget_used >= updatedDept.budget_monthly * updatedDept.budget_warning_threshold;

  return {
    allowed: true,
    budgetWarning: isWarning
      ? `Warning: Department budget usage at ${usagePercent.toFixed(1)}%`
      : undefined,
    budgetStatus: status,
  };
}
