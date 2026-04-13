"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ModelBreakdown, ProviderBreakdown } from "@/lib/db-types";

interface ReportCostBreakdownProps {
  byProvider: ProviderBreakdown[];
  byModel: ModelBreakdown[];
}

const COLORS = ["#c5a44e", "#10b981", "#4a90d9", "#d4953a", "#ab47bc", "#ef4444", "#0ea5e9"];

export function ReportCostBreakdown({ byProvider, byModel }: ReportCostBreakdownProps) {
  const providerData = byProvider.map((p) => ({
    name: p.provider,
    cost: parseFloat(p.costUsd.toFixed(2)),
  }));

  const modelData = byModel.map((m) => ({
    name: m.model,
    cost: parseFloat(m.costUsd.toFixed(2)),
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      return (
        <div
          className="p-2 rounded border text-xs"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <p className="font-medium">{payload[0].payload.name}</p>
          <p style={{ color: "var(--accent)" }}>
            ${payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Cost by Provider */}
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
          Cost by Provider
        </h3>
        {providerData.length === 0 ? (
          <div
            className="flex items-center justify-center h-48"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-xs">No data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={providerData}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 80 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `$${v.toFixed(2)}`}
                tick={{ fontSize: 12 }}
                stroke="var(--text-secondary)"
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 12 }}
                stroke="var(--text-secondary)"
                width={75}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cost" fill="#8884d8" radius={4}>
                {providerData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cost by Model */}
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
          Cost by Model
        </h3>
        {modelData.length === 0 ? (
          <div
            className="flex items-center justify-center h-48"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-xs">No data</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={modelData}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 100 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `$${v.toFixed(2)}`}
                tick={{ fontSize: 12 }}
                stroke="var(--text-secondary)"
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 12 }}
                stroke="var(--text-secondary)"
                width={95}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cost" fill="#8884d8" radius={4}>
                {modelData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
