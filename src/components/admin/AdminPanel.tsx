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

export function AdminPanel({ open, onOpenChange }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedUserForStats, setSelectedUserForStats] = useState<User | null>(null);

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
    }
  }, [open]);

  const handleSelectUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingUser(null);
    fetchUsers();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === "stats" && users.length > 0 && !selectedUserForStats) {
      setSelectedUserForStats(users[0]);
    }
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
          {isLoading && activeTab === "users" ? (
            <div className="flex items-center justify-center py-8">
              <span style={{ color: "var(--text-muted)" }}>Loading users...</span>
            </div>
          ) : error && activeTab === "users" ? (
            <div
              className="p-4 rounded-lg text-sm"
              style={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
            >
              {error}
            </div>
          ) : activeTab === "users" ? (
            <>
              {showForm ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {editingUser ? `Edit ${editingUser.username}` : "Create User"}
                    </h3>
                  </div>
                  <AdminUserForm
                    user={editingUser || undefined}
                    onSave={handleFormSave}
                    onCancel={handleFormCancel}
                  />
                </div>
              ) : (
                <AdminUserList
                  users={users}
                  onRefresh={fetchUsers}
                  onSelectUser={handleSelectUser}
                />
              )}
            </>
          ) : selectedUserForStats ? (
            <AdminUserStats
              userId={selectedUserForStats.id}
              username={selectedUserForStats.username}
            />
          ) : (
            <div
              className="p-4 rounded-lg text-sm text-center"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              Select a user from the Users tab to view stats
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
