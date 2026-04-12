"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Building2,
  Sparkles,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { AdminNotification } from "./AdminNotification";

interface DeptSpend {
  id: string;
  name: string;
  budgetMonthly: number;
  budgetUsed: number;
  memberCount: number;
  generationCount: number;
}

interface TopSpender {
  userId: string;
  username: string;
  displayName: string | null;
  departmentName: string | null;
  totalCost: number;
  generationCount: number;
}

interface ProviderCost {
  provider: string;
  count: number;
  totalCost: number;
}

interface ModelCost {
  model: string;
  provider: string;
  count: number;
  totalCost: number;
}

interface Stats {
  totalUsers: number;
  totalDepartments: number;
  totalGenerations: number;
  totalSpend: number;
  averageCostPerGeneration: number;
  departmentSpend: DeptSpend[];
  topSpenders: TopSpender[];
  costByProvider: ProviderCost[];
  costByModel: ModelCost[];
}

export function AdminStatsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <AdminNotification type="error" message={error} />
    );
  }

  if (!stats) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">
        No analytics available
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Users",
      value: stats.totalUsers.toString(),
      icon: Users,
    },
    {
      label: "Departments",
      value: stats.totalDepartments.toString(),
      icon: Building2,
    },
    {
      label: "Generations",
      value: stats.totalGenerations.toLocaleString(),
      icon: Sparkles,
    },
    {
      label: "Total Spend",
      value: formatCost(stats.totalSpend),
      icon: DollarSign,
    },
    {
      label: "Avg Cost/Gen",
      value: formatCost(stats.averageCostPerGeneration),
      icon: TrendingUp,
    },
  ];

  const maxSpend = Math.max(
    ...stats.topSpenders.map((s) => s.totalCost),
    0.01
  );
  const maxProviderCost = Math.max(
    ...stats.costByProvider.map((p) => p.totalCost),
    0.01
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-3">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="p-3 rounded-lg"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  {card.label}
                </span>
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Department budget overview */}
        <div
          className="p-4 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Department Budgets
          </h4>
          {stats.departmentSpend.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No departments configured
            </p>
          ) : (
            <div className="space-y-3">
              {stats.departmentSpend.map((dept) => {
                const ratio =
                  dept.budgetMonthly > 0
                    ? dept.budgetUsed / dept.budgetMonthly
                    : 0;
                const barColor =
                  ratio >= 1
                    ? "var(--status-error)"
                    : ratio >= 0.8
                      ? "var(--status-warning)"
                      : "var(--status-success)";

                return (
                  <div key={dept.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-[var(--text-primary)]">
                        {dept.name}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {dept.memberCount} users ·{" "}
                        {dept.budgetMonthly > 0
                          ? `${formatCost(dept.budgetUsed)} / ${formatCost(dept.budgetMonthly)}`
                          : "No budget"}
                      </span>
                    </div>
                    {dept.budgetMonthly > 0 && (
                      <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(ratio * 100, 100)}%`,
                            background: barColor,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top spenders */}
        <div
          className="p-4 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Top Spenders
          </h4>
          {stats.topSpenders.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No usage data available
            </p>
          ) : (
            <div className="space-y-2">
              {stats.topSpenders
                .filter((s) => s.totalCost > 0)
                .slice(0, 8)
                .map((spender, idx) => (
                  <div key={spender.userId} className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-muted)] w-4 text-right">
                      {idx + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {spender.displayName || spender.username}
                        </span>
                        <span className="text-xs text-[var(--text-primary)] font-medium ml-2">
                          {formatCost(spender.totalCost)}
                        </span>
                      </div>
                      <div className="w-full h-1 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(spender.totalCost / maxSpend) * 100}%`,
                            background: "var(--accent)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Cost by provider */}
        <div
          className="p-4 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Cost by Provider
          </h4>
          {stats.costByProvider.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No data</p>
          ) : (
            <div className="space-y-2">
              {stats.costByProvider.map((provider) => (
                <div key={provider.provider}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium text-[var(--text-primary)]">
                      {provider.provider}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {provider.count.toLocaleString()} calls ·{" "}
                      {formatCost(provider.totalCost)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(provider.totalCost / maxProviderCost) * 100}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost by model */}
        <div
          className="p-4 rounded-lg"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Top Models by Cost
          </h4>
          {stats.costByModel.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No data</p>
          ) : (
            <div className="space-y-1.5">
              {stats.costByModel.map((model) => (
                <div
                  key={`${model.model}-${model.provider}`}
                  className="flex items-center justify-between text-xs py-1"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-[var(--text-primary)]">
                      {model.model}
                    </span>
                    <span className="text-[var(--text-muted)] ml-1.5">
                      ({model.provider})
                    </span>
                  </div>
                  <div className="text-right ml-2">
                    <span className="text-[var(--text-primary)] font-medium">
                      {formatCost(model.totalCost)}
                    </span>
                    <span className="text-[var(--text-muted)] ml-1.5">
                      ({model.count.toLocaleString()})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
