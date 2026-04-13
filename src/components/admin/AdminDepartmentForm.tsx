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

interface Department {
  id: string;
  name: string;
  description: string | null;
  budgetMonthly: number;
  warningThreshold: number; // 0-1 ratio from API
  softLimitDollars: number;
  createdAt: string;
}

interface AdminDepartmentFormProps {
  department?: Department;
  onClose: () => void;
  onSave: () => void;
}

export function AdminDepartmentForm({
  department,
  onClose,
  onSave,
}: AdminDepartmentFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMonthly, setBudgetMonthly] = useState("");
  const [warningThreshold, setWarningThreshold] = useState("80");
  const [softLimit, setSoftLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description || "");
      setBudgetMonthly(
        department.budgetMonthly ? department.budgetMonthly.toString() : ""
      );
      // Convert 0-1 ratio to 0-100 percentage for display
      const thresholdPercent =
        department.warningThreshold <= 1
          ? Math.round(department.warningThreshold * 100)
          : department.warningThreshold;
      setWarningThreshold(thresholdPercent.toString());
      setSoftLimit(
        department.softLimitDollars
          ? department.softLimitDollars.toString()
          : ""
      );
    }
  }, [department]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Department name is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = department
        ? `/api/admin/departments/${department.id}`
        : "/api/admin/departments";

      const method = department ? "PUT" : "POST";

      // Send warningThreshold as percentage (0-100); API converts to 0-1
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          budgetMonthly: budgetMonthly ? parseFloat(budgetMonthly) : 0,
          budgetWarningThreshold: parseInt(warningThreshold) || 80,
          budgetSoftLimit: softLimit ? parseFloat(softLimit) : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save department");
      }

      onSave();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save department"
      );
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
          <DialogTitle>
            {department ? "Edit Department" : "New Department"}
          </DialogTitle>
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

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Department Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Design Team"
                className={inputClass}
                style={inputStyle}
                aria-label="Department name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
                className={inputClass}
                style={inputStyle}
                aria-label="Department description"
              />
            </div>

            <div
              className="p-3 rounded-lg space-y-3"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
              }}
            >
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Budget Settings
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Monthly Budget ($)
                  </label>
                  <input
                    type="number"
                    value={budgetMonthly}
                    onChange={(e) => setBudgetMonthly(e.target.value)}
                    placeholder="0 = unlimited"
                    min="0"
                    step="0.01"
                    className={inputClass}
                    style={inputStyle}
                    aria-label="Monthly budget"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Warning at (%)
                  </label>
                  <input
                    type="number"
                    value={warningThreshold}
                    onChange={(e) => setWarningThreshold(e.target.value)}
                    min="0"
                    max="100"
                    className={inputClass}
                    style={inputStyle}
                    aria-label="Warning threshold percentage"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Soft Limit Overage ($)
                </label>
                <input
                  type="number"
                  value={softLimit}
                  onChange={(e) => setSoftLimit(e.target.value)}
                  placeholder="Extra $ allowed over budget"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  style={inputStyle}
                  aria-label="Soft limit in dollars"
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Amount users can exceed monthly budget before being blocked.
                </p>
              </div>
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
            {loading ? "Saving..." : "Save"}
          </DialogButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
