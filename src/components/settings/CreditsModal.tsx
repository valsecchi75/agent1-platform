"use client";

import { useEffect } from "react";
import { BrandLogo } from "./BrandLogo";

interface CreditsModalProps {
  onClose: () => void;
}

export function CreditsModal({ onClose }: CreditsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-xl overflow-hidden flex flex-col shadow-2xl mx-4"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <BrandLogo variant="icon" height="h-7" />
            <div className="flex items-center gap-2">
              <BrandLogo variant="wordmark" height="h-4" />
              <span className="text-[8px] font-medium tracking-wider uppercase px-1.5 py-0.5 rounded" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }} >
                Alpha 0.9
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

          {/* About */}
          <Section title="About the Project">
            <p>
              AGENT 1 — From Vision to Form is an open-source, node-based platform for API-driven creative generation. Connect any image, video, audio, or LLM provider through a visual workflow editor — and build custom AI-powered pipelines without writing a single line of code.
            </p>
            <p className="mt-2">
              The app runs entirely on your machine. Your API keys, your generations, your workflows — everything stays local.
            </p>
            <p className="mt-2">
              AGENT 1 is a fork and evolution of{" "}
              <a href="https://github.com/shrimbly/node-banana" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: 'var(--accent)' }}>Node Banana</a>
              , the free and open-source node-based generative workflow editor by Willie Falloon.
            </p>
          </Section>

          {/* Installation */}
          <Section title="Installation">
            <p>The only prerequisite is <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Node.js 18+</span>. No other manual setup needed.</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>🪟 Windows</span>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Double-click <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--surface-3)' }}>start.bat</code>
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>🍎 macOS / Linux</span>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Run <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--surface-3)' }}>./start.sh</code>
                </p>
              </div>
            </div>
          </Section>

          {/* Authors */}
          <Section title="Author — Node Banana">
            <AuthorCard
              initials="WF"
              name="Willie Falloon"
              role="Creator of Node Banana — Original Project"
              bio="Free and open node-based generative workflow editor. ReactFlow canvas architecture, multi-provider node execution system."
              badge="Open source · MIT License · github.com/shrimbly/node-banana"
              links={[
                { type: "linkedin", url: "https://www.linkedin.com/in/willie-falloon-961a8a68/", label: "LinkedIn" },
                { type: "twitter", url: "https://x.com/ReflctWillie", label: "X / Twitter" },
                { type: "discord", url: "https://discord.com/invite/89Nr6EKkTf", label: "Discord" },
              ]}
            />
          </Section>

          <Section title="Fork &amp; Adaptation — AGENT 1">
            <AuthorCard
              initials="SV"
              accent
              name="Sergio Valsecchi"
              role="AGENT 1 Fork — Creator"
              bio="Creative technologist &amp; digital creative director. Forked Node Banana into AGENT 1 — expanding it into a multi-provider, multi-modal creative generation platform with a 10-skin theme system and custom node architecture."
              links={[
                { type: "linkedin", url: "https://www.linkedin.com/in/valsecchisergio/", label: "Contact on LinkedIn" },
              ]}
            />
          </Section>

          {/* Release */}
          <Section title="Release History">
            <div className="space-y-3">
              <div className="p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Alpha 0.9</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>March 2026</span>
                  <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }} >Current</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    "Morpheus Model Management node",
                    "Preview Image + Show Anything utility nodes",
                    "Output handles: image, description, metadata",
                    "Base64 conversion for API compatibility",
                    "Lazy image loading + catalog performance",
                    "Replit wake-up mechanism",
                    "26-node Foundation pack",
                    "RAG spec system for prompt-to-workflow",
                    "Gallery, Loved, Reports pages + SQLite",
                    "Session save/restore (multi-tab)",
                    "db-guard + start.bat native rebuild",
                    "Patreon auth + Supabase Edge Functions",
                  ].map((item, i) => (
                    <span key={i} className="text-[11px] flex gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent)' }}>+</span>{item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Alpha 0.7</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>March 2026</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    "Fork of Node Banana — all providers preserved",
                    "PIN + username/password auth + JWT",
                    "API key management panel (all providers)",
                    "10-skin theme system + dark/light",
                    "Data Tunnel WebGL login + audio-reactive",
                    "Custom nodes: manifest.json discovery",
                    "Neural Atelier node pack",
                    "shadcn/ui + Lucide icon system",
                    "Interactive canvas grid",
                    "Node selection accent glow",
                    "Cost dashboard with breakdown",
                    "Cross-platform launch scripts",
                  ].map((item, i) => (
                    <span key={i} className="text-[11px] flex gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent)' }}>+</span>{item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Built With */}
          <Section title="Built With">
            <div className="flex flex-wrap gap-1.5">
              {[
                "Next.js 16", "React 19", "ReactFlow 12", "Zustand 5", "Tailwind CSS 4",
                "TypeScript 5.9", "Gemini API", "Nano Banana 2/Pro", "Veo 3.1", "jose",
                "fal.ai", "Replicate", "WaveSpeed", "Kie.ai", "OpenAI", "Anthropic"
              ].map(t => (
                <span key={t} className="px-2 py-1 rounded text-[11px]" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {t}
                </span>
              ))}
            </div>
          </Section>

          {/* License */}
          <Section title="License">
            <p>
              AGENT 1 is built on Node Banana (MIT License). Modifications are by Sergio Valsecchi.
            </p>
          </Section>

          {/* Footer */}
          <div className="text-center text-[10px] pt-2" style={{ color: 'var(--text-muted)' }}>
            AGENT 1 — From Vision to Form · <a href="https://linkedin.com/in/valsecchisergio/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>Sergio Valsecchi</a> · 2026
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--accent)' }}>
        {title}
      </h2>
      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

interface AuthorLink {
  type: "linkedin" | "twitter" | "discord";
  url: string;
  label: string;
}

function AuthorCard({ initials, name, role, bio, badge, links, accent }: {
  initials: string; name: string; role: string; bio: string; badge?: string; links: AuthorLink[]; accent?: boolean;
}) {
  const icons: Record<string, React.ReactNode> = {
    linkedin: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
    twitter: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    discord: <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.36-.698.772-1.362 1.225-1.993a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.12-.098.246-.198.373-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>,
  };
  const colors: Record<string, string> = { linkedin: "#0A66C2", twitter: "#000000", discord: "#5865F2" };

  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: accent ? 'var(--accent-subtle)' : 'var(--surface-3)', color: accent ? 'var(--accent)' : 'var(--text-muted)' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h3>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{role}</p>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{bio}</p>
          {badge && <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{badge}</p>}
          {links.length > 0 && (
            <div className="flex gap-1.5 mt-2.5">
              {links.map(l => (
                <a key={l.type} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-opacity hover:opacity-80"
                  style={{ background: colors[l.type], color: '#fff' }}>
                  {icons[l.type]}{l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
