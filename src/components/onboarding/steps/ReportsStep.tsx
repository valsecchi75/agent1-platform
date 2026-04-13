"use client";

import { Heart, DollarSign, BarChart3, Clock } from "lucide-react";

const FEATURES = [
  { icon: Heart, label: "Favorites", desc: "Mark your best generations to find them fast" },
  { icon: DollarSign, label: "Cost Tracking", desc: "Monitor API spend per workflow and provider" },
  { icon: BarChart3, label: "Usage Reports", desc: "Visualize your generation activity over time" },
  { icon: Clock, label: "History", desc: "Browse and reload any previous generation" },
];

export function ReportsStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">Track Your Creations</h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">Every generation is saved automatically. Review, favorite, and analyze your work.</p>
      <div className="space-y-3">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
            <Icon className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-light">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
