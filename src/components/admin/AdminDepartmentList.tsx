"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Plus,
  Trash2,
  Users,
  DollarSign,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { AdminDepartmentForm } from "./AdminDepartmentForm";
import { AdminNotification } from "./AdminNotification";

interface Department {
  id: string;
  name: string;
  description: string | null;
  budgetMonthly: number;
  budgetUsed: number;
  warningThreshold: number;
  softLimitDollars: number;
  periodStart: string;
  memberCount: number;
  totalSpend: number;
  createdAt: string;
  updatedAt: string;
}

interface DepartmentMember {
  userId: string;
  username: string;
  displayName: string | null;
  role: string;
  totalCost: number;
  generationCount: number;
  lastActivity: string | null;
}

interface AdminDepartmentListProps {
  userRole?: "admin" | "dept_admin";
}

export function AdminDepartmentList({
  userRole = "admin",
}: AdminDepartmentListProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [memberCache, setMemberCache] = useState<
    Record<string, DepartmentMember[]>
  >({});
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch departments"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const fetchMembers = async (deptId: string) => {
    if (memberCache[deptId]) return;
    try {
      const res = await fetch(`/api/admin/departments/${deptId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      const data = await res.json();
      setMemberCache((prev) => ({ ...prev, [deptId]: data.members || [] }));
    } catch (err) {
      console.error("Failed to fetch members:", err);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      fetchMembers(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/departments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete department");
      }
      await fetchDepartments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete department"
      );
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setShowForm(true);
  };

  const handleCreateNew = () => {
    setEditingDept(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingDept(null);
  };

  const handleFormSave = () => {
    handleFormClose();
    setMemberCache({});
    fetchDepartments();
  };

  const getBudgetColor = (dept: Department) => {
    if (!dept.budgetMonthly || dept.budgetMonthly === 0) return "var(--text-muted)";
    const ratio = dept.budgetUsed / dept.budgetMonthly;
    if (ratio >= 1) return "var(--status-error)";
    if (ratio >= dept.warningThreshold) return "var(--status-warning)";
    return "var(--status-success)";
  };

  const getBudgetPercent = (dept: Department) => {
    if (!dept.budgetMonthly || dept.budgetMonthly === 0) return 0;
    return (dept.budgetUsed / dept.budgetMonthly) * 100;
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const getDaysRemaining = (periodStart: string) => {
    if (!periodStart) return null;
    const start = new Date(periodStart);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">
        Loading departments...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <AdminNotification
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Departments
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {departments.length} department{departments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {userRole === "admin" && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            aria-label="Create new department"
          >
            <Plus className="w-4 h-4" />
            New Department
          </button>
        )}
      </div>

      {departments.length === 0 ? (
        <div className="py-12 text-center text-[var(--text-muted)]">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>No departments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) => {
            const isExpanded = expandedIds.has(dept.id);
            const budgetPercent = getBudgetPercent(dept);
            const budgetColor = getBudgetColor(dept);
            const daysRemaining = getDaysRemaining(dept.periodStart);
            const members = memberCache[dept.id] || [];

            return (
              <div
                key={dept.id}
                className="rounded-lg overflow-hidden transition-colors"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Department header */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleExpanded(dept.id)}
                      className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-none"
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${dept.name}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium text-[var(--text-primary)]">
                          {dept.name}
                        </h4>
                        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <Users className="w-3 h-3" />
                          {dept.memberCount}
                        </span>
                      </div>

                      {dept.description && (
                        <p className="text-xs text-[var(--text-muted)] mb-3">
                          {dept.description}
                        </p>
                      )}

                      {/* Budget bar */}
                      {dept.budgetMonthly > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--text-muted)]">
                                Budget:
                              </span>
                              <span
                                className="font-medium"
                                style={{ color: budgetColor }}
                              >
                                {formatCost(dept.budgetUsed)} /{" "}
                                {formatCost(dept.budgetMonthly)}
                              </span>
                              <span
                                className="font-medium"
                                style={{ color: budgetColor }}
                              >
                                ({budgetPercent.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {dept.softLimitDollars > 0 && (
                                <span className="text-[var(--text-muted)]">
                                  Soft limit: +{formatCost(dept.softLimitDollars)}
                                </span>
                              )}
                              {daysRemaining !== null && (
                                <span className="flex items-center gap-1 text-[var(--text-muted)]">
                                  <Calendar className="w-3 h-3" />
                                  {daysRemaining}d left
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="w-full h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(budgetPercent, 100)}%`,
                                background: budgetColor,
                              }}
                            />
                          </div>
                          {budgetPercent >= 100 && (
                            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--status-error)" }}>
                              <AlertTriangle className="w-3 h-3" />
                              Budget exceeded
                              {dept.softLimitDollars > 0 &&
                                dept.budgetUsed <= dept.budgetMonthly + dept.softLimitDollars
                                ? " (within soft limit)"
                                : dept.softLimitDollars > 0
                                  ? " — soft limit breached!"
                                  : ""}
                            </div>
                          )}
                        </div>
                      )}

                      {dept.budgetMonthly === 0 && (
                        <p className="text-xs text-[var(--text-muted)] italic">
                          No budget configured
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(dept)}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-colors focus:outline-none"
                        aria-label={`Edit ${dept.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {userRole === "admin" && (
                        <button
                          onClick={() => handleDelete(dept.id)}
                          className="p-2 text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded-md transition-colors focus:outline-none"
                          aria-label={`Delete ${dept.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded: Member list with spending analysis */}
                {isExpanded && (
                  <div
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="p-4">
                      <h5 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                        Members &amp; Spending
                      </h5>

                      {members.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] py-2">
                          No members in this department.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {members.map((member) => {
                            const memberPercent =
                              dept.budgetUsed > 0
                                ? (member.totalCost / dept.budgetUsed) * 100
                                : 0;

                            return (
                              <div
                                key={member.userId}
                                className="flex items-center gap-3 p-2.5 rounded-md hover:bg-[var(--surface-3)]/50 transition-colors"
                              >
                                {/* User info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[var(--text-primary)]">
                                      {member.displayName || member.username}
                                    </span>
                                    {member.displayName && (
                                      <span className="text-xs text-[var(--text-muted)]">
                                        @{member.username}
                                      </span>
                                    )}
                                    <span
                                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                                      style={{
                                        background:
                                          member.role === "admin"
                                            ? "var(--status-error)"
                                            : member.role === "dept_admin"
                                              ? "var(--status-warning)"
                                              : "var(--status-success)",
                                      }}
                                    >
                                      {member.role === "dept_admin"
                                        ? "Dept Admin"
                                        : member.role === "admin"
                                          ? "Admin"
                                          : "User"}
                                    </span>
                                  </div>
                                  {member.lastActivity && (
                                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                      Last active:{" "}
                                      {new Date(
                                        member.lastActivity
                                      ).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>

                                {/* Spending stats */}
                                <div className="text-right space-y-0.5">
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className="text-xs text-[var(--text-muted)]">
                                      {member.generationCount} gen
                                      {member.generationCount !== 1 ? "s" : ""}
                                    </span>
                                    <span className="text-sm font-medium text-[var(--text-primary)]">
                                      {formatCost(member.totalCost)}
                                    </span>
                                  </div>
                                  {dept.budgetUsed > 0 && (
                                    <div className="flex items-center gap-1.5 justify-end">
                                      <div className="w-16 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${Math.min(memberPercent, 100)}%`,
                                            background: "var(--accent)",
                                          }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-medium text-[var(--text-muted)] w-10 text-right">
                                        {memberPercent.toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Department totals */}
                          <div
                            className="flex items-center justify-between pt-2 mt-2 text-xs"
                            style={{
                              borderTop: "1px solid var(--border)",
                            }}
                          >
                            <span className="text-[var(--text-muted)] font-medium">
                              Department Total
                            </span>
                            <span className="text-[var(--text-primary)] font-semibold">
                              {formatCost(dept.totalSpend)} across{" "}
                              {dept.memberCount} member
                              {dept.memberCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <AdminDepartmentForm
          department={editingDept || undefined}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
