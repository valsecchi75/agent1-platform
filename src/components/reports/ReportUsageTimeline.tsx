"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DailyTimelinePoint } from "@/lib/db-types";

interface ReportUsageTimelineProps {
  timeline: DailyTimelinePoint[];
}

export function ReportUsageTimeline({ timeline }: ReportUsageTimelineProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="p-2 rounded border text-xs"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <p className="font-medium">{payload[0].payload.date}</p>
          {payload.map((entry: any, idx: number) => (
            <p key={idx} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name === "Cost" ? " USD" : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = days[date.getDay()];
    const dayNum = date.getDate().toString().padStart(2, "0");
    return `${dayName} ${dayNum}`;
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
        Usage Timeline
      </h3>
      {timeline.length === 0 ? (
        <div
          className="flex items-center justify-center h-64"
          style={{ color: "var(--text-secondary)" }}
        >
          <p className="text-xs">No data</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={timeline} margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
            <defs>
              <linearGradient id="gradGen" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--accent)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--accent)"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
              stroke="var(--text-secondary)"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              stroke="var(--text-secondary)"
              label={{ value: "Generations", angle: -90, position: "insideLeft" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              stroke="var(--text-secondary)"
              label={{ value: "Cost (USD)", angle: 90, position: "insideRight" }}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="generations"
              name="Generations"
              stroke="var(--accent)"
              fill="url(#gradGen)"
              strokeWidth={2}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="costUsd"
              name="Cost"
              stroke="#10b981"
              fill="url(#gradCost)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
