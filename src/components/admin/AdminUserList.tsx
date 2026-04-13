"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Edit2,
  Plus,
  Trash2,
  Search,
  ArrowUpDown,
  DollarSign,
} from "lucide-react";
import { AdminUserForm } from "./AdminUserForm";
import { AdminNotification } from "./AdminNotification";

interface User {
  userId: string;
  username: string;
  displayName: string | null;
  role: "admin" | "dept_admin" | "user";
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  totalCost: number;
  generationCount: number;
}

interface AdminUserListProps {
  userRole?: "admin" | "dept_admin";
}

type SortField =
  | "username"
  | "role"
  | "department"
  | "totalCost"
  | "generationCount"
  | "lastLoginAt";
type SortDir = "asc" | "desc";

export function AdminUserList({ userRole = "admin" }: AdminUserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalCost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (userId: string, username: string) => {
    if (
      !window.confirm(
        `Delete user "${username}"? This will also delete all their generations. This cannot be undone.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleCreateNew = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleFormSave = () => {
    handleFormClose();
    fetchUsers();
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "totalCost" || field === "generationCount" ? "desc" : "asc");
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "var(--status-error)";
      case "dept_admin":
        return "var(--status-warning)";
      default:
        return "var(--status-success)";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "dept_admin":
        return "Dept Admin";
      default:
        return "User";
    }
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  // Filter
  const filtered = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.departmentName && u.departmentName.toLowerCase().includes(q))
    );
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "username":
        return dir * a.username.localeCompare(b.username);
      case "role": {
        const roleOrder = { admin: 0, dept_admin: 1, user: 2 };
        return dir * (roleOrder[a.role] - roleOrder[b.role]);
      }
      case "department":
        return (
          dir *
          (a.departmentName || "").localeCompare(b.departmentName || "")
        );
      case "totalCost":
        return dir * (a.totalCost - b.totalCost);
      case "generationCount":
        return dir * (a.generationCount - b.generationCount);
      case "lastLoginAt": {
        const aDate = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bDate = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return dir * (aDate - bDate);
      }
      default:
        return 0;
    }
  });

  // Calculate totals for the table footer
  const totalSpend = users.reduce((acc, u) => acc + u.totalCost, 0);
  const totalGenerations = users.reduce(
    (acc, u) => acc + u.generationCount,
    0
  );

  const SortHeader = ({
    field,
    label,
    className = "",
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
    <th
      className={`text-left px-3 py-2.5 font-medium text-[var(--text-muted)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <ArrowUpDown className="w-3 h-3 text-[var(--accent)]" />
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">
        Loading users...
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
      {/* Header with search and create */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users, departments..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              maxWidth: 320,
            }}
            aria-label="Search users"
          />
        </div>
        {userRole === "admin" && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors bg-[var(--accent)] text-[var(--btn-primary-text)] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            aria-label="Create new user"
          >
            <Plus className="w-4 h-4" />
            New User
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className="p-3 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-xs text-[var(--text-muted)]">Total Users</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {users.length}
          </p>
        </div>
        <div
          className="p-3 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-xs text-[var(--text-muted)]">Total Spend</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {formatCost(totalSpend)}
          </p>
        </div>
        <div
          className="p-3 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-xs text-[var(--text-muted)]">Total Generations</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {totalGenerations}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-muted)]">
          {searchQuery
            ? "No users match your search."
            : "No users yet. Create one to get started."}
        </div>
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  <SortHeader field="username" label="User" />
                  <SortHeader field="role" label="Role" />
                  <SortHeader field="department" label="Department" />
                  <SortHeader
                    field="generationCount"
                    label="Generations"
                    className="text-right"
                  />
                  <SortHeader
                    field="totalCost"
                    label="Spend"
                    className="text-right"
                  />
                  <SortHeader field="lastLoginAt" label="Last Login" />
                  <th className="px-3 py-2.5 font-medium text-[var(--text-muted)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {sorted.map((user) => {
                  const spendPercent =
                    totalSpend > 0
                      ? (user.totalCost / totalSpend) * 100
                      : 0;

                  return (
                    <tr
                      key={user.userId}
                      className="hover:bg-[var(--surface-3)]/50 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <div>
                          <span className="font-medium text-[var(--text-primary)]">
                            {user.displayName || user.username}
                          </span>
                          {user.displayName && (
                            <span className="block text-[10px] text-[var(--text-muted)]">
                              @{user.username}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                          style={{ background: getRoleColor(user.role) }}
                        >
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)]">
                        {user.departmentName || (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[var(--text-primary)]">
                        {user.generationCount}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div>
                          <span className="font-medium text-[var(--text-primary)]">
                            {formatCost(user.totalCost)}
                          </span>
                          {spendPercent > 0 && (
                            <div className="flex items-center gap-1 justify-end mt-0.5">
                              <div className="w-12 h-1 bg-[var(--surface-3)] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(spendPercent, 100)}%`,
                                    background: "var(--accent)",
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {spendPercent.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-muted)]">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-colors focus:outline-none"
                            aria-label={`Edit ${user.username}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {userRole === "admin" && (
                            <button
                              onClick={() =>
                                handleDelete(user.userId, user.username)
                              }
                              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded-md transition-colors focus:outline-none"
                              aria-label={`Delete ${user.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <AdminUserForm
          user={editingUser || undefined}
          onClose={handleFormClose}
          onSave={handleFormSave}
          canEditRole={userRole === "admin"}
          canEditDepartment={userRole === "admin"}
        />
      )}
    </div>
  );
}
