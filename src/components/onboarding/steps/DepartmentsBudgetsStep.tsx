"use client";

import { Building2, DollarSign, AlertTriangle, Calendar } from "lucide-react";

export function DepartmentsBudgetsStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">
        Departments &amp; Budgets
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        Organize your team into departments and control API spending with monthly budgets, warnings, and soft limits.
      </p>

      {/* Visual budget bar mockup */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs font-medium text-[var(--text-primary)]">Design Team</span>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto">18 days left</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1.5">
          <span>$34.20 / $50.00</span>
          <span className="font-medium" style={{ color: "var(--status-warning)" }}>68.4%</span>
        </div>
        <div className="w-full h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: "68%", background: "var(--status-warning)" }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
          <DollarSign className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">Monthly Budgets</p>
            <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">
              Set a dollar limit per department. Spending resets automatically each billing period.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
          <AlertTriangle className="w-4 h-4 text-[var(--status-warning)] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">Warning Thresholds</p>
            <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">
              Get notified when a department approaches its limit (default: 80%). Color-coded progress bars show status at a glance.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
          <Calendar className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">Soft Limits</p>
            <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">
              Allow a grace amount over budget before blocking. Perfect for teams that need flexibility without losing control.
            </p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-muted)] mt-4 text-center font-light">
        Expand any department in the Admin Panel to see per-member spending breakdown
      </p>
    </div>
  );
}
