"use client";

import { useState } from "react";
import { Trash2, Edit2, BarChart3 } from "lucide-react";
import { DialogButton } from "@/components/ui/dialog";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  role: "admin" | "dept_admin" | "user";
  department_id: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface AdminUserListProps {
  users: User[];
  onRefresh: () => void;
  onSelectUser: (user: User) => void;
  onCreate: () => void;
  onViewStats: (user: User) => void;
}

export function AdminUserList({
  users,
  onRefresh,
  onSelectUser,
  onCreate,
  onViewStats,
}: AdminUserListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteUser = async (userId: string) => {
    if (deleteConfirm !== userId) {
      setDeleteConfirm(userId);
      setDeleteError("");
      return;
    }

    try {
      setDeletingId(userId);
      setDeleteError("");
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete user");
      }

      setDeleteConfirm(null);
      onRefresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {deleteError && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          {deleteError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          {users.length} user{users.length !== 1 ? "s" : ""}
        </span>
        <DialogButton variant="primary" onClick={onCreate}>
          Create User
        </DialogButton>
      </div>

      {/* Users table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                Username
              </th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                Display Name
              </th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                Role
              </th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                Department
              </th>
              <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                Last Login
              </th>
              <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--text-primary)" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <span style={{ color: "var(--text-muted)" }}>No users yet. Click "Create User" to add one.</span>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: deleteConfirm === user.id ? "var(--surface-3)" : undefined,
                  }}
                >
                  <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
                    {user.username}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {user.display_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background:
                          user.role === "admin"
                            ? "var(--accent)"
                            : user.role === "dept_admin"
                              ? "var(--accent)"
                              : "var(--surface-3)",
                        color:
                          user.role === "admin" || user.role === "dept_admin"
                            ? "var(--btn-primary-text)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {user.department_id ? user.department_id.substring(0, 8) : "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {formatDate(user.last_login_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirm === user.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Delete this user?
                        </span>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deletingId === user.id}
                          className="text-xs px-2 py-1 rounded font-medium transition-colors"
                          style={{
                            background: "#dc2626",
                            color: "white",
                          }}
                        >
                          {deletingId === user.id ? "..." : "Yes, Delete"}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          disabled={deletingId === user.id}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: "var(--surface-3)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onViewStats(user)}
                          className="p-1.5 rounded transition-colors"
                          title="View stats"
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
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectUser(user)}
                          className="p-1.5 rounded transition-colors"
                          title="Edit user"
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
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1.5 rounded transition-colors"
                          title="Delete user"
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
