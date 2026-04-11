"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTabs,
  DialogBody,
} from "@/components/ui/dialog";
import { AdminUserList } from "./AdminUserList";
import { AdminUserForm } from "./AdminUserForm";
import { AdminUserStats } from "./AdminUserStats";
import { AdminSystemInfo } from "./AdminSystemInfo";
import { AdminDepartmentList } from "./AdminDepartmentList";
import { AdminDepartmentForm } from "./AdminDepartmentForm";
import { useWorkflowStore } from "@/store/workflowStore";

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
  description: string | null;
  budget_monthly: number;
  budget_used: number;
  budget_warning_threshold: number;
  budget_soft_limit: number;
  memberCount: number;
}

interface AdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UserView = "list" | "create" | "edit" | "stats";
type DeptView = "list" | "create" | "edit";

export function AdminPanel({ open, onOpenChange }: AdminPanelProps) {
  const currentUser = useWorkflowStore((s) => s.currentUser);
  const isGlobalAdmin = currentUser?.role === "admin";

  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [userView, setUserView] = useState<UserView>("list");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [statsUser, setStatsUser] = useState<User | null>(null);
  const [deptView, setDeptView] = useState<DeptView>("list");
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchUsers();
      setUserView("list");
      setDeptView("list");
      setActiveTab("users");
    }
  }, [open]);

  const handleSelectUser = (user: User) => {
    setEditingUser(user);
    setUserView("edit");
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setUserView("create");
  };

  const handleViewStats = (user: User) => {
    setStatsUser(user);
    setActiveTab("stats");
  };

  const handleFormSave = () => {
    setUserView("list");
    setEditingUser(null);
    fetchUsers();
  };

  const handleFormCancel = () => {
    setUserView("list");
    setEditingUser(null);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "users") setUserView("list");
    if (tabId === "departments") setDeptView("list");
    if (tabId === "stats" && !statsUser && users.length > 0) setStatsUser(users[0]);
  };

  const renderUsersTab = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <span style={{ color: "var(--text-muted)" }}>Loading users...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
        >
          {error}
        </div>
      );
    }

    if (userView === "create" || userView === "edit") {
      return (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={handleFormCancel}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
            >
              &larr; Back
            </button>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {userView === "edit" && editingUser
                ? `Edit ${editingUser.username}`
                : "Create New User"}
            </h3>
          </div>
          <AdminUserForm
            user={editingUser || undefined}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        </div>
      );
    }

    return (
      <AdminUserList
        users={users}
        onRefresh={fetchUsers}
        onSelectUser={handleSelectUser}
        onCreate={handleCreateUser}
        onViewStats={handleViewStats}
      />
    );
  };

  const renderDepartmentsTab = () => {
    if (deptView === "create" || deptView === "edit") {
      return (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                setDeptView("list");
                setEditingDept(null);
              }}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
            >
              &larr; Back
            </button>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {deptView === "edit" && editingDept ? `Edit ${editingDept.name}` : "Create Department"}
            </h3>
          </div>
          <AdminDepartmentForm
            department={editingDept || undefined}
            onSave={() => {
              setDeptView("list");
              setEditingDept(null);
            }}
            onCancel={() => {
              setDeptView("list");
              setEditingDept(null);
            }}
          />
        </div>
      );
    }
    return (
      <AdminDepartmentList
        onEdit={(dept) => {
          setEditingDept(dept);
          setDeptView("edit");
        }}
        onCreate={() => setDeptView("create")}
      />
    );
  };

  const renderStatsTab = () => {
    if (users.length === 0) {
      return (
        <div
          className="p-4 rounded-lg text-sm text-center"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          No users to show stats for.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* User selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            User:
          </label>
          <select
            value={statsUser?.id || ""}
            onChange={(e) => {
              const u = users.find((u) => u.id === e.target.value);
              if (u) setStatsUser(u);
            }}
            className="px-3 py-1.5 rounded-lg border text-sm"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} {u.display_name ? `(${u.display_name})` : ""}
              </option>
            ))}
          </select>
        </div>

        {statsUser && (
          <AdminUserStats userId={statsUser.id} username={statsUser.username} />
        )}
      </div>
    );
  };

  const tabs = [
    ...(isGlobalAdmin ? [{ id: "departments", label: "Departments" }] : []),
    { id: "users", label: "Users" },
    { id: "stats", label: "Stats" },
    { id: "system", label: "System" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Admin Panel</DialogTitle>
        </DialogHeader>

        <DialogTabs tabs={tabs} active={activeTab} onChange={handleTabChange} />

        <DialogBody>
          {activeTab === "departments"
            ? renderDepartmentsTab()
            : activeTab === "users"
              ? renderUsersTab()
              : activeTab === "stats"
                ? renderStatsTab()
                : <AdminSystemInfo />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
