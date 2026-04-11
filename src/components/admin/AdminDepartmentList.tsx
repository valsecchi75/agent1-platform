"use client";

import { useState, useEffect } from "react";
import { Trash2, Edit2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { DialogButton } from "@/components/ui/dialog";

interface Department {
  id: string;
  name: string;
  description: string | null;
  budget_monthly: number;
  budget_used: number;
  budget_warning_threshold: number;
  budget_soft_limit: number;
  memberCount: number;
}

interface Member {
  userId: string;
  username: string;
  displayName: string | null;
  role: string;
  totalCost: number;
  generationCount: number;
  lastActivity: string | null;
}

interface AdminDepartmentListProps {
  onEdit: (dept: Department) => void;
  onCreate: () => void;
}

export function AdminDepartmentList({ onEdit, onCreate }: AdminDepartmentListProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      setError("");
      const res = await fetch("/api/admin/departments");
      if (!res.ok) throw new Error("Failed to fetch departments");
      const data = await res.json();
      setDepartments(data.departments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const toggleExpand = async (deptId: string) => {
    if (expandedId === deptId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(deptId);
    if (!members[deptId]) {
      setLoadingMembers(deptId);
      try {
        const res = await fetch(`/api/admin/departments/${deptId}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers((prev) => ({ ...prev, [deptId]: data.members || [] }));
        }
      } catch {
        // Silently fail
      } finally {
        setLoadingMembers(null);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      setDeleteError("");
      return;
    }
    try {
      setDeletingId(id);
      const res = await fetch(`/api/admin/departments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      setDeleteConfirm(null);
      fetchDepartments();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  const getBudgetColor = (dept: Department) => {
    if (dept.budget_monthly <= 0) return "var(--text-muted)";
    const ratio = dept.budget_used / dept.budget_monthly;
    if (ratio >= 1) return "#ef4444";
    if (ratio >= dept.budget_warning_threshold) return "#eab308";
    return "#22c55e";
  };

  const getBudgetPercent = (dept: Department) => {
    if (dept.budget_monthly <= 0) return 0;
    return Math.min((dept.budget_used / dept.budget_monthly) * 100, 100);
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-8">
        <span style={{ color: "var(--text-muted)" }}>Loading departments...</span>
      </div>
    );
  if (error)
    return (
      <div
        className="p-4 rounded-lg text-sm"
        style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
      >
        {error}
      </div>
    );

  return (
    <div className="space-y-4">
      {deleteError && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{
            background: "rgba(239,68,68,0.15)",
            color: "#f87171",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          {deleteError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {departments.length} department{departments.length !== 1 ? "s" : ""}
        </span>
        <DialogButton variant="primary" onClick={onCreate}>
          Create Department
        </DialogButton>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th
                className="text-left px-4 py-2 font-medium"
                style={{ color: "var(--text-primary)", width: "24px" }}
              ></th>
              <th
                className="text-left px-4 py-2 font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Name
              </th>
              <th
                className="text-left px-4 py-2 font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Members
              </th>
              <th
                className="text-left px-4 py-2 font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Budget
              </th>
              <th
                className="text-right px-4 py-2 font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center">
                  <span style={{ color: "var(--text-muted)" }}>No departments yet.</span>
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <>
                  <tr
                    key={dept.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      background:
                        deleteConfirm === dept.id
                          ? "var(--surface-3)"
                          : expandedId === dept.id
                            ? "var(--surface-2)"
                            : undefined,
                    }}
                    onClick={() => toggleExpand(dept.id)}
                  >
                    <td className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                      {expandedId === dept.id ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: "var(--text-primary)" }}>{dept.name}</div>
                      {dept.description && (
                        <div
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {dept.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        <span style={{ color: "var(--text-secondary)" }}>
                          {dept.memberCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ minWidth: "160px" }}>
                      {dept.budget_monthly > 0 ? (
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span style={{ color: "var(--text-secondary)" }}>
                              ${dept.budget_used.toFixed(2)} / ${dept.budget_monthly.toFixed(2)}
                            </span>
                            <span style={{ color: getBudgetColor(dept) }}>
                              {Math.round(getBudgetPercent(dept))}%
                            </span>
                          </div>
                          <div
                            className="w-full h-1.5 rounded-full"
                            style={{ background: "var(--surface-3)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${getBudgetPercent(dept)}%`,
                                background: getBudgetColor(dept),
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          No budget set
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {deleteConfirm === dept.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDelete(dept.id)}
                            disabled={deletingId === dept.id}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{
                              background: "#dc2626",
                              color: "white",
                            }}
                          >
                            {deletingId === dept.id ? "..." : "Yes"}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              background: "var(--surface-3)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEdit(dept)}
                            className="p-1.5 rounded transition-colors"
                            title="Edit"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--surface-3)";
                              e.currentTarget.style.color = "var(--text-primary)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--text-muted)";
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(dept.id)}
                            className="p-1.5 rounded transition-colors"
                            title="Delete"
                            style={{ color: "var(--text-muted)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--surface-3)";
                              e.currentTarget.style.color = "#f87171";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--text-muted)";
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedId === dept.id && (
                    <tr key={`${dept.id}-members`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={5} className="px-8 py-3" style={{ background: "var(--surface-2)" }}>
                        {loadingMembers === dept.id ? (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            Loading members...
                          </span>
                        ) : (members[dept.id] || []).length === 0 ? (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            No members in this department.
                          </span>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                <th
                                  className="text-left px-2 py-1 font-medium"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  User
                                </th>
                                <th
                                  className="text-left px-2 py-1 font-medium"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Role
                                </th>
                                <th
                                  className="text-right px-2 py-1 font-medium"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Spend
                                </th>
                                <th
                                  className="text-right px-2 py-1 font-medium"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Generations
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(members[dept.id] || []).map((m) => (
                                <tr key={m.userId}>
                                  <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                                    {m.username}
                                    {m.displayName ? ` (${m.displayName})` : ""}
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <span
                                      className="px-1.5 py-0.5 rounded-full"
                                      style={{
                                        background:
                                          m.role === "dept_admin"
                                            ? "var(--accent)"
                                            : "var(--surface-3)",
                                        color:
                                          m.role === "dept_admin"
                                            ? "var(--btn-primary-text)"
                                            : "var(--text-secondary)",
                                      }}
                                    >
                                      {m.role}
                                    </span>
                                  </td>
                                  <td
                                    className="px-2 py-1.5 text-right"
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    ${m.totalCost.toFixed(2)}
                                  </td>
                                  <td
                                    className="px-2 py-1.5 text-right"
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    {m.generationCount}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
