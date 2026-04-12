"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ReportCostBreakdown } from "@/components/reports/ReportCostBreakdown";
import { ReportRecentActivity } from "@/components/reports/ReportRecentActivity";
import { ReportSummaryCards } from "@/components/reports/ReportSummaryCards";
import { ReportUsageTimeline } from "@/components/reports/ReportUsageTimeline";
import { ReportData } from "@/lib/db-types";

export default function ReportsPage() {
  const emptyReportData: ReportData = {
    summary: {
      totalGenerations: 0,
      totalApiCalls: 0,
      totalCostUsd: 0,
      avgCostPerGeneration: 0,
      previousPeriod: {
        totalGenerations: 0,
        totalCostUsd: 0,
      },
    },
    allTime: {
      totalGenerations: 0,
      totalCostUsd: 0,
      totalApiCalls: 0,
      firstGenerationDate: null,
    },
    byProvider: [],
    byModel: [],
    timeline: [],
    recentCalls: [],
  };

  const [data, setData] = useState<ReportData>(emptyReportData);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
  }>(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const formatDate = (date: Date) => date.toISOString().split("T")[0];

    return {
      from: formatDate(thirtyDaysAgo),
      to: formatDate(today),
    };
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("from", dateRange.from);
      params.append("to", dateRange.to);

      const response = await fetch(`/api/db/reports?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch reports");

      const reportData: ReportData = await response.json();
      setData(reportData);
    } catch (err) {
      // Gracefully degrade: show layout with zero data instead of blank screen
      console.error("Failed to fetch reports:", err);
      setData(emptyReportData);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDateChange = (field: "from" | "to", value: string) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--background)" }}
    >
      <PageHeader />

      {/* Page title + date range selector */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-7xl mx-auto flex items-end justify-between">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Reports
          </h1>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <label
                className="text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                From
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => handleDateChange("from", e.target.value)}
                className="px-2 py-1 text-xs rounded border"
                style={{
                  background: "var(--surface-1)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <span
              className="text-xs font-medium mt-5"
              style={{ color: "var(--text-secondary)" }}
            >
              to
            </span>

            <div className="flex flex-col">
              <label
                className="text-xs font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                To
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => handleDateChange("to", e.target.value)}
                className="px-2 py-1 text-xs rounded border"
                style={{
                  background: "var(--surface-1)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          {loading ? (
            <div
              className="flex items-center justify-center h-96"
              style={{ color: "var(--text-secondary)" }}
            >
              <p>Loading reports...</p>
            </div>
          ) : (
            <>
              {/* All-Time Totals Banner */}
              <div
                className="p-4 rounded border"
                style={{
                  background: "var(--surface-1)",
                  borderColor: "var(--accent)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      className="text-sm font-semibold uppercase tracking-wider mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      All-Time Totals
                      {data.allTime.firstGenerationDate && (
                        <span className="font-normal normal-case tracking-normal ml-2">
                          since {data.allTime.firstGenerationDate}
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-6 mt-2">
                      <div>
                        <span
                          className="text-2xl font-bold"
                          style={{ color: "var(--accent)" }}
                        >
                          ${data.allTime.totalCostUsd.toFixed(2)}
                        </span>
                        <span
                          className="text-xs ml-1"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          total spent
                        </span>
                      </div>
                      <div>
                        <span
                          className="text-lg font-bold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {data.allTime.totalGenerations}
                        </span>
                        <span
                          className="text-xs ml-1"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          generations
                        </span>
                      </div>
                      <div>
                        <span
                          className="text-lg font-bold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {data.allTime.totalApiCalls}
                        </span>
                        <span
                          className="text-xs ml-1"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          API calls
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Period Summary */}
              <ReportSummaryCards summary={data.summary} />
              <ReportCostBreakdown
                byProvider={data.byProvider}
                byModel={data.byModel}
              />
              <ReportUsageTimeline timeline={data.timeline} />
              <ReportRecentActivity calls={data.recentCalls} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
