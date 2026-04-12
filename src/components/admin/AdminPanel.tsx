"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTabs,
  DialogBody,
} from "@/components/ui/dialog";
import { AdminDepartmentList } from "./AdminDepartmentList";
import { AdminUserList } from "./AdminUserList";
import { AdminStatsTab } from "./AdminStatsTab";
import { AdminSystemTab } from "./AdminSystemTab";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: "admin" | "dept_admin";
}

export function AdminPanel({
  isOpen,
  onClose,
  userRole = "admin",
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("departments");

  const tabs = [];

  // Both admin and dept_admin can see departments
  if (userRole === "admin" || userRole === "dept_admin") {
    tabs.push({ id: "departments", label: "Departments" });
  }

  // Both admin and dept_admin can manage users (dept_admin sees only their dept)
  if (userRole === "admin" || userRole === "dept_admin") {
    tabs.push({ id: "users", label: "Users" });
  }

  // Only admin gets stats and system
  if (userRole === "admin") {
    tabs.push({ id: "stats", label: "Analytics" });
    tabs.push({ id: "system", label: "System" });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="full" hideClose>
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <DialogTitle>Admin Panel</DialogTitle>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors focus:outline-none"
              aria-label="Close admin panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {tabs.length > 0 && (
          <DialogTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
        )}

        <DialogBody>
          {activeTab === "departments" && (
            <AdminDepartmentList userRole={userRole} />
          )}
          {activeTab === "users" && <AdminUserList userRole={userRole} />}
          {activeTab === "stats" && <AdminStatsTab />}
          {activeTab === "system" && <AdminSystemTab />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
