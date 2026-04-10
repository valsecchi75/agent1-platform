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

interface User {
  id: string;
  username: string;
  display_name: string | null;
  role: "admin" | "user";
  created_at: string;
  last_login_at: string | null;
}

interface AdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type View = "list" | "create" | "edit" | "stats";

export function AdminPanel({ open, onOpenChange }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [statsUser, setStatsUser] = useState<User | null>(null);

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
      setView("list");
      setActiveTab("users");
    }
  }, [open]);

  const handleSelectUser = (user: User) => {
    setEditingUser(user);
    setView("edit");
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setView("create");
  };

  const handleViewStats = (user: User) => {
    setStatsUser(user);
    setActiveTab("stats");
  };

  const handleFormSave = () => {
    setView("list");
    setEditingUser(null);
    fetchUsers();
  };

  const handleFormCancel = () => {
    setView("list");
    setEditingUser(null);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "users") {
      setView("list");
    }
    if (tabId === "stats" && !statsUser && users.length > 0) {
      setStatsUser(users[0]);
    }
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

    if (view === "create" || view === "edit") {
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
              {view === "edit" && editingUser
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Admin Panel</DialogTitle>
        </DialogHeader>

        <DialogTabs
          tabs={[
            { id: "users", label: "Users" },
            { id: "stats", label: "Stats" },
          ]}
          active={activeTab}
          onChange={handleTabChange}
        />

        <DialogBody>
          {activeTab === "users" ? renderUsersTab() : renderStatsTab()}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
