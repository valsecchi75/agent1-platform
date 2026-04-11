"use client";

import { useState, useEffect } from "react";
import { DialogFooter, DialogButton } from "@/components/ui/dialog";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  role: "admin" | "dept_admin" | "user";
  department_id: string | null;
  created_at: string;
  last_login_at: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface AdminUserFormProps {
  user?: User;
  onSave: () => void;
  onCancel: () => void;
}

export function AdminUserForm({ user, onSave, onCancel }: AdminUserFormProps) {
  const isEditMode = !!user;
  const [username, setUsername] = useState(user?.username || "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [role, setRole] = useState<"admin" | "dept_admin" | "user">(user?.role || "user");
  const [departmentId, setDepartmentId] = useState(user?.department_id || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch("/api/admin/departments");
        if (res.ok) {
          const data = await res.json();
          setDepartments(data.departments || []);
        }
      } catch {
        // Silently fail
      }
    };
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isEditMode) {
        // PUT request for edit mode
        const body: Record<string, unknown> = {
          displayName,
          role,
          departmentId: departmentId || null,
        };
        if (password) {
          body.newPassword = password;
        }

        const response = await fetch(`/api/admin/users/${user!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update user");
        }
      } else {
        // POST request for create mode
        if (!username || !password) {
          throw new Error("Username and password are required");
        }

        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            displayName,
            role,
            departmentId: departmentId || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to create user");
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          className="p-3 rounded-lg text-sm"
          style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
        >
          {error}
        </div>
      )}

      {!isEditMode && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            disabled={isEditMode}
            className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          {isEditMode ? "New Password (leave blank to keep current)" : "Password"}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEditMode ? "(optional)" : "••••••••"}
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          Display Name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="John Doe"
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "dept_admin" | "user")}
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <option value="user">User</option>
          <option value="dept_admin">Department Admin</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {(role === "user" || role === "dept_admin") && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
            Department {role === "dept_admin" ? "(required)" : "(optional)"}
          </label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required={role === "dept_admin"}
            className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">— None —</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <DialogFooter>
        <DialogButton variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </DialogButton>
        <DialogButton variant="primary" type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : isEditMode ? "Update" : "Create"}
        </DialogButton>
      </DialogFooter>
    </form>
  );
}
