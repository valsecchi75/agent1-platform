"use client";

export function CanvasStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">The Canvas</h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">This is your creative workspace. Drag, connect, and run.</p>
      <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-6 min-h-[260px]">
        <div className="absolute top-0 left-0 right-0 h-8 bg-[var(--surface-2)] rounded-t-lg border-b border-[var(--border)] flex items-center px-3 gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Workflow Canvas</span>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto rounded-lg border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[var(--accent)] text-lg">+</div>
            <p className="text-[10px] text-[var(--text-secondary)] font-medium">Add Nodes</p>
            <p className="text-[9px] text-[var(--text-muted)] font-light">Right-click or use shortcuts</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-1 mx-auto">
              <div className="w-8 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)]" />
              <div className="w-6 h-0.5 bg-[var(--accent)]" />
              <div className="w-8 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)]" />
            </div>
            <p className="text-[10px] text-[var(--text-secondary)] font-medium">Connect</p>
            <p className="text-[9px] text-[var(--text-muted)] font-light">Drag from output to input handles</p>
          </div>
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto rounded-lg border border-[var(--accent)] bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)] text-xs font-medium">Run</div>
            <p className="text-[10px] text-[var(--text-secondary)] font-medium">Execute</p>
            <p className="text-[9px] text-[var(--text-muted)] font-light">Ctrl+Enter or click Run</p>
          </div>
        </div>
        <div className="mt-6 flex justify-center gap-6 text-[9px] text-[var(--text-muted)]">
          <span>Scroll to zoom</span>
          <span>Space + drag to pan</span>
          <span>Ctrl+Z to undo</span>
        </div>
      </div>
    </div>
  );
}
