"use client";

import { useEffect } from "react";

import { useOnboardingStore } from "@/store/onboardingStore";

import { ApiKeysStep } from "./steps/ApiKeysStep";
import { CanvasStep } from "./steps/CanvasStep";
import { DepartmentsBudgetsStep } from "./steps/DepartmentsBudgetsStep";
import { NodesStep } from "./steps/NodesStep";
import { ProTipsStep } from "./steps/ProTipsStep";
import { ReportsStep } from "./steps/ReportsStep";
import { TeamRolesStep } from "./steps/TeamRolesStep";
import { WelcomeStep } from "./steps/WelcomeStep";

const STEPS = [
  { component: WelcomeStep, label: "Welcome" },
  { component: ApiKeysStep, label: "API Keys" },
  { component: CanvasStep, label: "Canvas" },
  { component: NodesStep, label: "Nodes" },
  { component: ReportsStep, label: "Reports" },
  { component: TeamRolesStep, label: "Team" },
  { component: DepartmentsBudgetsStep, label: "Budgets" },
  { component: ProTipsStep, label: "Tips" },
];

export function OnboardingWizard() {
  const { showWizard, currentStep, nextStep, prevStep, completeWizard, checkShouldShow, dontShowAgain, setDontShowAgain } =
    useOnboardingStore();

  useEffect(() => {
    // Don't show on login page
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/login") return;
    }
    checkShouldShow();
  }, [checkShouldShow]);

  if (!showWizard) return null;

  const StepComponent = STEPS[currentStep].component;
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-[720px] min-h-[480px] rounded-xl border border-[var(--modal-border)] bg-[var(--modal-bg)] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "85vh" }}
      >
        {/* Skip link */}
        <button
          onClick={completeWizard}
          className="absolute top-4 right-5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] uppercase tracking-[0.15em] transition-colors z-10"
        >
          Skip tutorial
        </button>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          <StepComponent />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {STEPS.map((step, i) => (
                <button
                  key={step.label}
                  onClick={() => useOnboardingStore.getState().goToStep(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? "bg-[var(--accent)] scale-125"
                      : i < currentStep
                      ? "bg-[var(--accent)] opacity-40"
                      : "bg-[var(--text-muted)] opacity-30"
                  }`}
                  title={step.label}
                />
              ))}
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
                style={{ accentColor: "var(--accent)" }}
              />
              <span className="text-[10px] text-[var(--text-muted)]">Don&apos;t show again</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="px-4 py-2 text-xs rounded-md bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-hover)] transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? completeWizard : nextStep}
              className="px-5 py-2 text-xs rounded-md font-medium transition-all hover:brightness-110"
              style={{ background: "var(--accent)", color: "var(--btn-primary-text)" }}
            >
              {isLast ? "Start Creating" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
