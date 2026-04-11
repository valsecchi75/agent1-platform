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

export function getEstimatedCost(cost: number | undefined | null): number {
  return (cost != null && cost > 0) ? cost : DEFAULT_ESTIMATED_COST;
}

export function checkBudget(input: BudgetCheckInput): BudgetCheckResult {
  const { departmentId, role, estimatedCost } = input;

  if (!departmentId) return { allowed: true };

  ensureBudgetPeriodCurrent(departmentId);
  const dept = getDepartmentById(departmentId);
  if (!dept) return { allowed: true };
  if (dept.budget_monthly <= 0) return { allowed: true };

  const usageRatio = dept.budget_used / dept.budget_monthly;
  const usagePercent = Math.round(usageRatio * 100);
  const budgetStatus = {
    departmentName: dept.name,
    budgetMonthly: dept.budget_monthly,
    budgetUsed: dept.budget_used,
    usagePercent,
  };

  // Admin and dept_admin bypass enforcement but still get warnings
  if (role === 'admin' || role === 'dept_admin') {
    const warning = usageRatio >= dept.budget_warning_threshold
      ? `Department "${dept.name}" has used ${usagePercent}% of monthly budget`
      : undefined;
    return { allowed: true, budgetWarning: warning, budgetStatus };
  }

  // Block if strictly over limit (exact boundary is allowed)
  if (dept.budget_used + estimatedCost > dept.budget_monthly + dept.budget_soft_limit) {
    return { allowed: false, budgetExceeded: true, budgetStatus };
  }

  // Warning if at threshold
  if (usageRatio >= dept.budget_warning_threshold) {
    return {
      allowed: true,
      budgetWarning: `Department "${dept.name}" has used ${usagePercent}% of monthly budget`,
      budgetStatus,
    };
  }

  return { allowed: true, budgetStatus };
}
