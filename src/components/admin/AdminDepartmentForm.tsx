"use client";

import { useState } from "react";
import { DialogFooter, DialogButton } from "@/components/ui/dialog";

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

interface AdminDepartmentFormProps {
  department?: Department;
  onSave: () => void;
  onCancel: () => void;
}

export function AdminDepartmentForm({
  department,
  onSave,
  onCancel,
}: AdminDepartmentFormProps) {
  const isEdit = !!department;
  const [name, setName] = useState(department?.name || "");
  const [description, setDescription] = useState(department?.description || "");
  const [budgetMonthly, setBudgetMonthly] = useState(
    department?.budget_monthly?.toString() || "0"
  );
  const [warningThreshold, setWarningThreshold] = useState(
    ((department?.budget_warning_threshold ?? 0.8) * 100).toString()
  );
  const [softLimit, setSoftLimit] = useState(
    department?.budget_soft_limit?.toString() || "0"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = {
    background: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text-primary)",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      budgetMonthly: parseFloat(budgetMonthly) || 0,
      budgetWarningThreshold: (parseFloat(warningThreshold) || 80) / 100,
      budgetSoftLimit: parseFloat(softLimit) || 0,
    };

    try {
      const url = isEdit
        ? `/api/admin/departments/${department!.id}`
        : "/api/admin/departments";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save department");
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

      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-primary)" }}
        >
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Design, Marketing"
          required
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
          style={inputStyle}
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: "var(--text-primary)" }}
        >
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            Monthly Budget ($)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={budgetMonthly}
            onChange={(e) => setBudgetMonthly(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            Warning (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={warningThreshold}
            onChange={(e) => setWarningThreshold(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
            style={inputStyle}
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            Soft Limit ($)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={softLimit}
            onChange={(e) => setSoftLimit(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm transition-colors"
            style={inputStyle}
          />
        </div>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Warning triggers at the threshold %. Soft limit allows overspend up to this extra
        $ amount. Set budget to 0 to disable budget tracking.
      </p>

      <DialogFooter>
        <DialogButton variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </DialogButton>
        <DialogButton variant="primary" type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : isEdit ? "Update" : "Create"}
        </DialogButton>
      </DialogFooter>
    </form>
  );
}
