"use client";

import { useEffect, useState } from "react";

interface UserStats {
  userId: string;
  generationCount: number;
  totalCost: number;
  costByProvider: Array<{
    provider: string;
    cost: number;
    calls: number;
  }>;
}

interface AdminUserStatsProps {
  userId: string;
  username: string;
}

export function AdminUserStats({ userId, username }: AdminUserStatsProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError("");
        const response = await fetch(`/api/admin/users/${userId}/stats`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch stats");
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchStats();
    }
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span style={{ color: "var(--text-muted)" }}>Loading stats...</span>
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

  if (!stats) {
    return (
      <div style={{ color: "var(--text-muted)" }}>
        No stats available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
          {username}
        </h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          User ID: {userId}
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="p-3 rounded-lg"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Generations
          </div>
          <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {stats.generationCount}
          </div>
        </div>

        <div
          className="p-3 rounded-lg col-span-2"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Total Cost
          </div>
          <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            ${stats.totalCost.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Cost by provider */}
      {stats.costByProvider.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
            Cost by Provider
          </h4>
          <div className="space-y-2">
            {stats.costByProvider.map((provider) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between p-2 rounded-lg"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div>
                  <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {provider.provider}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {provider.calls} call{provider.calls !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                  ${provider.cost.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
