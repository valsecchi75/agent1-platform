"use client";

import { useEffect, useMemo } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { ProviderType } from "@/types/providers";
import { PredictedCostResult, CostBreakdownItem, formatCost } from "@/utils/costCalculator";

interface CostDialogProps {
  predictedCost: PredictedCostResult;
  incurredCost: number;
  onClose: () => void;
}

const PROVIDER_NAMES: Record<ProviderType, string> = {
  gemini: "Gemini",
  fal: "fal.ai",
  replicate: "Replicate",
  openai: "OpenAI",
  anthropic: "Anthropic",
  kie: "Kie.ai",
  wavespeed: "WaveSpeed",
};

const PROVIDER_COLORS: Record<ProviderType, string> = {
  gemini: "#34d399",
  fal: "#a78bfa",
  replicate: "#60a5fa",
  openai: "#2dd4bf",
  anthropic: "#fbbf24",
  kie: "#fb923c",
  wavespeed: "#c084fc",
};

export function CostDialog({ predictedCost, incurredCost, onClose }: CostDialogProps) {
  const resetIncurredCost = useWorkflowStore((state) => state.resetIncurredCost);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleReset = () => {
    if (confirm("Reset all cost tracking to $0.00?")) {
      resetIncurredCost();
    }
  };

  // Group by provider
  const providerStats = useMemo(() => {
    const map = new Map<ProviderType, { items: CostBreakdownItem[]; total: number; count: number }>();
    predictedCost.breakdown.forEach((item) => {
      const existing = map.get(item.provider);
      if (existing) {
        existing.items.push(item);
        existing.total += item.subtotal ?? 0;
        existing.count += item.count;
      } else {
        map.set(item.provider, { items: [item], total: item.subtotal ?? 0, count: item.count });
      }
    });
    return map;
  }, [predictedCost]);

  const totalNodes = predictedCost.nodeCount;
  const totalImages = predictedCost.breakdown.reduce((s, i) => s + i.count, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="rounded-xl w-[560px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Workflow Cost Dashboard
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Estimated and incurred costs for this workflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            {incurredCost > 0 && (
              <button
                onClick={handleReset}
                className="px-2.5 py-1 text-[10px] rounded-md transition-colors"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Reset
              </button>
            )}
            <button onClick={onClose} className="p-1 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Top stats row */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Generation Nodes" value={String(totalNodes)} />
            <StatCard label="Total Runs" value={String(totalImages)} />
            <StatCard label="Estimated Cost" value={formatCost(predictedCost.totalCost)} accent />
            <StatCard label="Incurred Cost" value={formatCost(incurredCost)} accent />
          </div>

          {/* Provider breakdown */}
          {providerStats.size > 0 && (
            <div className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Provider Breakdown
              </h3>

              {/* Provider bar chart */}
              <div className="flex h-3 rounded-full overflow-hidden mb-3" style={{ background: 'var(--surface-3)' }}>
                {Array.from(providerStats.entries()).map(([provider, stats]) => {
                  const pct = totalImages > 0 ? (stats.count / totalImages) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={provider}
                      className="h-full transition-all"
                      style={{ width: `${pct}%`, background: PROVIDER_COLORS[provider] }}
                      title={`${PROVIDER_NAMES[provider]}: ${stats.count} runs (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              {/* Provider details table */}
              <div className="space-y-2">
                {Array.from(providerStats.entries()).map(([provider, stats]) => (
                  <div key={provider} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: PROVIDER_COLORS[provider] }}
                    />
                    <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-secondary)' }}>
                      {PROVIDER_NAMES[provider]}
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {stats.count} run{stats.count !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs font-medium tabular-nums w-16 text-right" style={{ color: 'var(--text-primary)' }}>
                      {stats.total > 0 ? formatCost(stats.total) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model detail table */}
          {predictedCost.breakdown.length > 0 && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="px-4 py-2.5" style={{ background: 'var(--surface-2)' }}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Model Detail
                </h3>
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--surface-3)' }}>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Model</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Provider</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Runs</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Unit Cost</th>
                    <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {predictedCost.breakdown.map((item, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.modelName}
                      </td>
                      <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: PROVIDER_COLORS[item.provider] }}
                          />
                          {PROVIDER_NAMES[item.provider]}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {item.count}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {item.subtotal !== null && item.count > 0
                          ? formatCost(item.subtotal / item.count)
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.subtotal !== null ? formatCost(item.subtotal) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td className="px-4 py-2 font-semibold" style={{ color: 'var(--text-primary)' }} colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {totalImages}
                    </td>
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>
                      {formatCost(predictedCost.totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Empty state */}
          {predictedCost.nodeCount === 0 && (
            <div className="rounded-lg p-8 text-center" style={{ background: 'var(--surface-2)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No generation nodes in workflow yet.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Add image, video, or LLM nodes to see cost estimates.
              </p>
            </div>
          )}

          {/* Pricing reference */}
          <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Pricing Reference
            </h3>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span>Nano Banana: $0.039/img</span>
              <span>NB Pro 1K: $0.134/img</span>
              <span>NB Pro 4K: $0.240/img</span>
              <span>NB 2 1K: $0.067/img</span>
              <span>NB 2 2K: $0.101/img</span>
              <span>NB 2 4K: $0.151/img</span>
            </div>
            <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              External provider pricing varies — check provider dashboards for actuals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Card subcomponent ── */
function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
      <div
        className="text-lg font-bold tabular-nums"
        style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
    </div>
  );
}
