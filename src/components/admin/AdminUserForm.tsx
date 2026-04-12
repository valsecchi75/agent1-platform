"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogButton,
} from "@/components/ui/dialog";
import { AdminNotification } from "./AdminNotification";

interface User {
  userId: string;
  username: string;
  displayName: string | null;
  role: "admin" | "dept_admin" | "user";
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

interface AdminUserFormProps {
  user?: User;
  onClose: () => void;
  onSave: () => void;
  canEditRole?: boolean;
  canEditDepartment?: boolean;
}

export function AdminUserForm({
  user,
  onClose,
  onSave,
  canEditRole = true,
  canEditDepartment = true,
}: AdminUserFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "dept_admin" | "user">("user");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setDisplayName(user.displayName || "");
      setRole(user.role);
      setDepartmentId(user.departmentId || "");
    }
    fetchDepartments();
  }, [user]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/admin/departments");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error("Failed to fetch departments:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!user && !password.trim()) {
      setError("Password is required for new users");
      return;
    }

    // Validate: non-admin users should have a department
    if (role !== "admin" && !departmentId && canEditDepartment) {
      setError("Please assign a department for this user");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = user ? `/api/admin/users/${user.userId}` : "/api/admin/users";
      const method = user ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        username: username.trim(),
        displayName: displayName.trim() || null,
      };

      if (canEditRole) {
        body.role = role;
      }
      if (canEditDepartment) {
        body.departmentId = departmentId || null;
      }

      if (password.trim() || !user) {
        body.password = password.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save user");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg border text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "New User"}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <AdminNotification
                type="error"
                message={error}
                onDismiss={() => setError(null)}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="johndoe"
                  disabled={!!user}
                  className={`${inputClass} disabled:opacity-50`}
                  style={inputStyle}
                  aria-label="Username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="John Doe"
                  className={inputClass}
                  style={inputStyle}
                  aria-label="Display name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Password {user && "(leave blank to keep current)"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={user ? "Optional — keep current" : "Enter password"}
                className={inputClass}
                style={inputStyle}
                aria-label="Password"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "admin" | "dept_admin" | "user")
                  }
                  disabled={!canEditRole}
                  className={`${inputClass} disabled:opacity-50`}
                  style={{
                    ...inputStyle,
                    color: "var(--text-primary)",
                  }}
                  aria-label="User role"
                >
                  <option value="user">User</option>
                  <option value="dept_admin">Department Admin</option>
                  <option value="admin">Global Admin</option>
                </select>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {role === "admin"
                    ? "Full system access, all departments"
                    : role === "dept_admin"
                      ? "Can manage users within their department"
                      : "Standard user with budget enforcement"}
                </p>
              </div>

              {role !== "admin" && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    disabled={!canEditDepartment}
                    className={`${inputClass} disabled:opacity-50`}
                    style={{
                      ...inputStyle,
                      color: "var(--text-primary)",
                    }}
                    aria-label="Department"
                  >
                    <option value="">Select a department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <DialogButton
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </DialogButton>
          <DialogButton
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Saving..." : user ? "Update User" : "Create User"}
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
