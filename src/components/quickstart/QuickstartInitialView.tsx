"use client";

import { useState, useEffect } from "react";
import { BrandLogo } from "@/components/settings/BrandLogo";
import { formatVersion } from "@/lib/appVersion";

interface QuickstartInitialViewProps {
  onNewProject: () => void;
  onSelectTemplates: () => void;
  onSelectVibe: () => void;
  onSelectLoad: () => void;
  onLoadLastWorkflow: () => void;
  onRestoreSession: () => void;
}

export function QuickstartInitialView({
  onNewProject,
  onSelectTemplates,
  onSelectVibe,
  onSelectLoad,
  onLoadLastWorkflow,
  onRestoreSession,
}: QuickstartInitialViewProps) {
  // Check if last workflow and session data are available
  const [hasLastWorkflow, setHasLastWorkflow] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [lastWorkflowName, setLastWorkflowName] = useState<string | null>(null);
  const [sessionTabCount, setSessionTabCount] = useState(0);

  useEffect(() => {
    // Check for last workflow
    fetch("/api/db/last-workflow")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.workflow) {
          setHasLastWorkflow(true);
          setLastWorkflowName(data.workflowName || null);
        }
      })
      .catch(() => {});

    // Check for saved session (uses file-based restore endpoint)
    fetch("/api/session/restore")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.session && data.session.tabs?.length > 0) {
          setHasSession(true);
          setSessionTabCount(data.session.tabs.length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header — Logo + Title */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-[-0.01em]" style={{ color: 'var(--text-primary)' }}>
                agent<sup style={{ fontSize: '0.5em', verticalAlign: 'super', marginLeft: '2px', color: 'var(--accent)', fontWeight: 700 }}>1</sup>
              </span>
              <span className="text-[9px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                {formatVersion()}
              </span>
            </div>
            <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              From Vision to Form
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
            AGENT 1
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="text-[10px] tracking-wide" style={{ color: 'var(--text-muted)' }}>
            AI-Powered Workflow Platform
          </span>
        </div>
      </div>

      {/* 3x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <OptionButton
          onClick={onNewProject}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          }
          title="New project"
          description="Start a new workflow"
        />

        <OptionButton
          onClick={onSelectLoad}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
            />
          }
          title="Load workflow"
          description="Open existing file"
        />

        <OptionButton
          onClick={onSelectTemplates}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          }
          title="Templates"
          description="Pre-built workflows"
        />

        <OptionButton
          onClick={onSelectVibe}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          }
          title="Prompt a workflow"
          description="Get Gemini to build it"
          badge="Beta"
        />

        {/* Last Workflow — opens the last workflow that generated an image */}
        <OptionButton
          onClick={onLoadLastWorkflow}
          disabled={!hasLastWorkflow}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          }
          title="Last workflow"
          description={hasLastWorkflow
            ? (lastWorkflowName ? `Resume "${lastWorkflowName}"` : "Resume last generation")
            : "No recent workflow"
          }
        />

        {/* Last Status — restore all open tabs from the previous session */}
        <OptionButton
          onClick={onRestoreSession}
          disabled={!hasSession}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m-15 0A2.25 2.25 0 003 12v3a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 15v-3a2.25 2.25 0 00-1.5-2.122"
            />
          }
          title="Last status"
          description={hasSession
            ? `Restore ${sessionTabCount} workflow tab${sessionTabCount !== 1 ? "s" : ""}`
            : "No saved session"
          }
        />
      </div>
    </div>
  );
}

function OptionButton({
  onClick,
  icon,
  title,
  description,
  badge,
  disabled = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group text-left p-4 rounded-lg transition-all duration-150"
      style={{
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-1)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--surface-2)';
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.background = 'var(--surface-1)';
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: 'var(--surface-3)' }}
        >
          <svg
            className="w-4 h-4 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {icon}
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium transition-colors" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            {badge && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
        </div>
      </div>
    </button>
  );
}
