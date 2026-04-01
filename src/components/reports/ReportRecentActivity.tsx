"use client";

import { DbApiCall } from "@/lib/db-types";

interface ReportRecentActivityProps {
  calls: DbApiCall[];
}

const CALL_TYPE_COLORS: Record<string, string> = {
  generation: "#c5a44e",
  llm_analysis: "#4a90d9",
  vision: "#10b981",
  prompt_compilation: "#ab47bc",
};

const CALL_TYPE_LABELS: Record<string, string> = {
  generation: "Generation",
  llm_analysis: "LLM Analysis",
  vision: "Vision",
  prompt_compilation: "Prompt Compile",
};

export function ReportRecentActivity({ calls }: ReportRecentActivityProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (ms: number) => {
    return (ms / 1000).toFixed(1);
  };

  return (
    <div
      className="p-3 rounded border"
      style={{
        background: "var(--surface-1)",
        borderColor: "var(--border)",
      }}
    >
      <h3
        className="text-sm font-bold mb-3"
        style={{ color: "var(--text-primary)" }}
      >
        Recent Activity
      </h3>

      {calls.length === 0 ? (
        <div
          className="flex items-center justify-center py-12"
          style={{ color: "var(--text-secondary)" }}
        >
          <p className="text-xs">No API calls</p>
        </div>
      ) : (
        <div style={{ maxHeight: "320px", overflowY: "auto" }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th
                  className="text-left py-2 px-2 font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Time
                </th>
                <th
                  className="text-left py-2 px-2 font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Type
                </th>
                <th
                  className="text-left py-2 px-2 font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Provider
                </th>
                <th
                  className="text-left py-2 px-2 font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Model
                </th>
                <th
                  className="text-right py-2 px-2 font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cost
                </th>
                <th
                  className="text-right py-2 px-2 font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Duration
                </th>
                <th
                  className="text-center py-2 px-2 font-bold"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr
                  key={call.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td
                    className="py-2 px-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatTime(call.created_at)}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-neutral-50 font-medium"
                      style={{
                        background: CALL_TYPE_COLORS[call.call_type] || "#888888",
                      }}
                    >
                      {CALL_TYPE_LABELS[call.call_type] || call.call_type}
                    </span>
                  </td>
                  <td
                    className="py-2 px-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {call.provider}
                  </td>
                  <td
                    className="py-2 px-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {call.model}
                  </td>
                  <td
                    className="py-2 px-2 text-right"
                    style={{ color: "var(--accent)" }}
                  >
                    ${call.cost_usd.toFixed(4)}
                  </td>
                  <td
                    className="py-2 px-2 text-right"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatDuration(call.duration_ms)}s
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span
                      style={{
                        color: call.status === "success" ? "#10b981" : "#ef4444",
                      }}
                    >
                      {call.status === "success" ? "✓" : "✕"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
