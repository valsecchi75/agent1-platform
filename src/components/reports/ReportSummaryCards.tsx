"use client";

import { Images, Zap, DollarSign, TrendingUp } from "lucide-react";
import { ReportSummary } from "@/lib/db-types";

interface ReportSummaryCardsProps {
  summary: ReportSummary;
}

function calculatePctChange(current: number, previous: number): string {
  if (previous === 0) return "0";
  return (((current - previous) / previous) * 100).toFixed(0);
}

export function ReportSummaryCards({ summary }: ReportSummaryCardsProps) {
  const generationsPctChange = calculatePctChange(
    summary.totalGenerations,
    summary.previousPeriod.totalGenerations
  );
  const costPctChange = calculatePctChange(
    summary.totalCostUsd,
    summary.previousPeriod.totalCostUsd
  );

  const generationsIsPositive = parseInt(generationsPctChange) >= 0;
  const costIsPositive = parseInt(costPctChange) >= 0;

  const cards = [
    {
      icon: Images,
      label: "Total Generations",
      value: summary.totalGenerations.toString(),
      pctChange: generationsPctChange,
      isPositive: generationsIsPositive,
    },
    {
      icon: Zap,
      label: "Total API Calls",
      value: summary.totalApiCalls.toString(),
      pctChange: "0%",
      isPositive: true,
    },
    {
      icon: DollarSign,
      label: "Total Cost",
      value: `$${summary.totalCostUsd.toFixed(2)}`,
      pctChange: costPctChange,
      isPositive: costIsPositive,
    },
    {
      icon: TrendingUp,
      label: "Avg Cost/Gen",
      value: `$${summary.avgCostPerGeneration.toFixed(4)}`,
      pctChange: "0%",
      isPositive: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ icon: Icon, label, value, pctChange, isPositive }) => (
        <div
          key={label}
          className="p-3 rounded border"
          style={{
            background: "var(--surface-1)",
            borderColor: "var(--border)",
          }}
        >
          {/* Icon + Label */}
          <div className="flex items-center gap-2 mb-2">
            <Icon
              className="w-4 h-4"
              style={{ color: "var(--accent)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {label}
            </span>
          </div>

          {/* Value */}
          <div
            className="text-lg font-bold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </div>

          {/* Trend */}
          <div
            className="text-xs font-medium"
            style={{
              color: isPositive ? "#10b981" : "#ef4444",
            }}
          >
            {isPositive ? "+" : ""}{pctChange}% vs last period
          </div>
        </div>
      ))}
    </div>
  );
}
