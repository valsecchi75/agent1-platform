"use client";

import { Shield, UserCog, User } from "lucide-react";

const ROLES = [
  {
    icon: Shield,
    label: "Admin",
    color: "var(--status-error)",
    desc: "Full system access: manage all users, departments, budgets, analytics, and system settings.",
  },
  {
    icon: UserCog,
    label: "Dept Admin",
    color: "var(--status-warning)",
    desc: "Manages users within their department. Monitors team spending and generation activity.",
  },
  {
    icon: User,
    label: "User",
    color: "var(--status-success)",
    desc: "Standard creative user. Generates content within assigned department budget limits.",
  },
];

export function TeamRolesStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">
        Team &amp; Roles
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        Agent 1 supports multiple users with role-based access. Each person gets their own workspace, API keys, and generation history.
      </p>

      <div className="space-y-3 mb-5">
        {ROLES.map(({ icon: Icon, label, color, desc }) => (
          <div
            key={label}
            className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]"
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}18`, color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-4">
        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium mb-2">
          Managing Users
        </p>
        <div className="grid grid-cols-2 gap-3 text-[10px] text-[var(--text-secondary)] font-light">
          <div className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">+</span>
            <span>Create users and assign them a role and department</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">+</span>
            <span>Each user stores their own encrypted API keys</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">+</span>
            <span>Track individual spend and generation count</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[var(--accent)] mt-0.5">+</span>
            <span>Search, sort, and filter the full user list</span>
          </div>
        </div>
      </div>
    </div>
  );
}
