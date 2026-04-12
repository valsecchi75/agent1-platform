"use client";

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-12 py-8">
      <div className="mb-6">
        <img src="/brands/A1-logo-neg.png" alt="Agent 1" className="h-14 mx-auto mb-4" />
      </div>
      <h2 className="text-2xl font-light text-[var(--text-primary)] tracking-wide mb-3">
        Welcome to Agent 1
      </h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed font-light">
        Your generative AI workflow editor. Connect any API, build visual pipelines,
        and generate images, video, audio, and text — all from one canvas.
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-6 tracking-wide uppercase">
        Let&apos;s get you set up in under a minute
      </p>
    </div>
  );
}
