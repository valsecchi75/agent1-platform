"use client";

import { useState, useMemo } from "react";
import { CostDialog } from "./CostDialog";
import { useWorkflowStore } from "@/store/workflowStore";
import { calculatePredictedCost, formatCost } from "@/utils/costCalculator";

export function CostIndicator() {
  const [showDialog, setShowDialog] = useState(false);
  const nodes = useWorkflowStore((state) => state.nodes);
  const incurredCost = useWorkflowStore((state) => state.incurredCost);

  const predictedCost = useMemo(() => {
    return calculatePredictedCost(nodes);
  }, [nodes]);

  const hasAnyNodes = predictedCost.nodeCount > 0;
  const displayCost = hasAnyNodes ? formatCost(predictedCost.totalCost) : formatCost(incurredCost);

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1.5"
        style={{ color: 'var(--text-muted)' }}
        title="View cost dashboard"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {displayCost}
      </button>

      {showDialog && (
        <CostDialog
          predictedCost={predictedCost}
          incurredCost={incurredCost}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  );
}
