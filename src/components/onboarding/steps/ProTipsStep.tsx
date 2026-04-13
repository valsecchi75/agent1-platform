"use client";

import { Keyboard, Save, Sparkles, Settings } from "lucide-react";

const TIPS = [
  { icon: Keyboard, title: "Keyboard Shortcuts", desc: "Press ? to see all shortcuts. Ctrl+Enter runs the workflow." },
  { icon: Save, title: "Save as Template", desc: "Save your best workflows as reusable templates." },
  { icon: Sparkles, title: "AI Quickstart", desc: "Describe what you want — AI builds the workflow for you." },
  { icon: Settings, title: "Admin Panel", desc: "Manage users, departments, and budgets from the settings menu." },
];

export function ProTipsStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">You&apos;re Ready</h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">A few tips to get the most out of Agent 1.</p>
      <div className="space-y-3">
        {TIPS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border)]">
            <Icon className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">{title}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <p className="text-xs text-[var(--text-secondary)] font-light">
          You can restart this tutorial anytime from <span className="text-[var(--accent)]">Settings</span>.
        </p>
      </div>
    </div>
  );
}
