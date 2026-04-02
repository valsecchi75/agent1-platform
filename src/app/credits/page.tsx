"use client";

import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/settings/BrandLogo";

export default function CreditsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--text-primary)' }}>
      {/* Header bar */}
      <div className="h-11 flex items-center px-6" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to AGENT 1
        </button>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Title */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <BrandLogo variant="icon" height="h-12" />
            <div>
              <div className="flex items-center gap-2">
                <BrandLogo variant="wordmark" height="h-7" />
                <span className="text-[9px] font-medium tracking-wider uppercase px-2 py-1 rounded" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }} >
                  Alpha 1.0
                </span>
              </div>
              <p className="text-xs tracking-widest uppercase mt-1" style={{ color: 'var(--text-muted)' }}>From Vision to Form</p>
            </div>
          </div>
        </div>

        {/* About */}
        <Section title="About the Project">
          <p>
            AGENT 1 — From Vision to Form is an open-source, node-based platform for API-driven creative generation. Connect any image, video, audio, or LLM provider through a visual workflow editor — and build custom AI-powered pipelines without writing a single line of code.
          </p>
          <p className="mt-3">
            The app runs entirely on your machine. Your API keys, your generations, your workflows — everything stays local. No cloud subscription, no third-party data storage beyond the AI API calls themselves.
          </p>
          <p className="mt-3">
            AGENT 1 is a fork and evolution of{" "}
            <a href="https://github.com/shrimbly/node-banana" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: 'var(--accent)' }}>Node Banana</a>
            {" "}by Willie Falloon — a free, open-source node-based generative workflow editor. The original architecture, node system, and multi-provider canvas engine form the foundation that AGENT 1 builds upon and extends.
          </p>
        </Section>

        {/* Installation */}
        <Section title="Installation">
          <p>The only prerequisite is <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Node.js 18+</span>. No other manual setup needed — the app installs its own dependencies automatically on first launch.</p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🪟</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Windows</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Install Node.js 18+ from <span style={{ color: 'var(--text-primary)' }}>nodejs.org</span>. Then double-click <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--surface-3)' }}>start.bat</code> inside the app folder. Done.
              </p>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🍎</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>macOS / Linux</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Install Node.js 18+ from <span style={{ color: 'var(--text-primary)' }}>nodejs.org</span> or via Homebrew. Then run <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: 'var(--surface-3)' }}>./start.sh</code> in Terminal. Done.
              </p>
            </div>
          </div>

          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            On first launch, missing packages are installed automatically — no manual npm install required. The app opens at http://localhost:3000. Configure your API keys via the Settings panel or edit the .env file directly.
          </p>
        </Section>

        {/* Original Author */}
        <Section title="Author — Node Banana">
          <AuthorCard
            initials="WF"
            initialsColor="var(--text-muted)"
            initialsBg="var(--surface-3)"
            name="Willie Falloon"
            role="Creator of Node Banana — Original Project"
            bio="Creator of Node Banana — free and open node-based generative workflow editor. Node Banana introduced the ReactFlow canvas architecture, the multi-provider node execution system, and the visual workflow paradigm that AGENT 1 builds upon."
            badge="Open source · MIT License · github.com/shrimbly/node-banana"
            links={[
              { type: "linkedin", url: "https://www.linkedin.com/in/willie-falloon-961a8a68/", label: "LinkedIn" },
              { type: "twitter", url: "https://x.com/ReflctWillie", label: "X / Twitter" },
              { type: "discord", url: "https://discord.com/invite/89Nr6EKkTf", label: "Discord" },
            ]}
          />
        </Section>

        {/* Fork Author */}
        <Section title="Fork &amp; Adaptation — AGENT 1">
          <AuthorCard
            initials="SV"
            initialsColor="var(--accent)"
            initialsBg="var(--accent-subtle)"
            name="Sergio Valsecchi"
            role="AGENT 1 Fork — Creator"
            bio="Creative technologist &amp; digital creative director. Building tools at the intersection of AI, design, and generative systems. Forked Node Banana into AGENT 1 — expanding it into a multi-provider, multi-modal creative generation platform with a 10-skin theme system and custom node architecture."
            links={[
              { type: "linkedin", url: "https://www.linkedin.com/in/valsecchisergio/", label: "Contact on LinkedIn" },
            ]}
          />
        </Section>

        {/* Release Notes */}
        <Section title="Release History">
          <div className="space-y-4">
            <ReleaseEntry
              version="Alpha 1.0"
              date="April 2026"
              current
              changes={[
                "Node bypass (Ctrl+B) — ComfyUI-style skip with diagonal stripe overlay and centered badge",
                "Audio handle on GenerateVideoNode — connect audio output to video generation for synchronized video+audio",
                "Array batch mode — batchMode toggle runs sequential per-item downstream execution",
                "Optional inputs — isOptional flag on ImageInput, AudioInput, Prompt nodes to allow empty pass-through",
                "PreviewImage node redesigned — fully responsive, unified fullBleed layout, aspectFitMedia support",
                "ShowAnything node redesigned — responsive layout, neutral palette, color-coded content-type badge",
              ]}
            />
            <ReleaseEntry
              version="Alpha 0.9"
              date="March 2026"
              changes={[
                "Morpheus Model Management node — talent catalog with Patreon auth + Supabase Edge Functions",
                "Preview Image utility node — inline image preview with pass-through output",
                "Show Anything utility node — universal content viewer (image, text, video, audio, JSON)",
                "Output handle system — image, description, metadata handles with full downstream wiring",
                "Base64 image conversion for downstream API compatibility (Gemini, etc.)",
                "Lazy image loading — per-page URL resolution for catalog performance",
                "Replit wake-up mechanism with 15s timeout + loading/error UI",
                "26-node AGENT 1 Foundation pack (up from 23)",
                "RAG spec system — JSON spec files powering prompt-to-workflow generation",
                "Gallery, Loved, Reports pages + SQLite database layer",
                "Cross-platform resilience: db-guard, start.bat native module auto-rebuild",
                "Session save/restore with multi-tab support",
              ]}
            />
            <ReleaseEntry
              version="Alpha 0.7"
              date="March 2026"
              changes={[
                "Fork of Node Banana with full node/provider preservation",
                "PIN + username/password auth with JWT sessions",
                "API key management panel for all providers (Settings)",
                "10-skin theme system (Aurora, Ember, Matrix, Sienna, Sage, Orchid, Platinum, Abyss, Amber, Ocean)",
                "Dark/Light theme with full CSS variable system",
                "Immersive login page: Data Tunnel WebGL + audio-reactive effects",
                "Custom nodes system: manifest.json discovery, Neural Atelier pack",
                "shadcn/ui design system + Lucide icons across all components",
                "Interactive canvas grid with mouse-reactive dot illumination",
                "Node selection rotating accent glow",
                "Cost dashboard with provider breakdown and model detail table",
                "Cross-platform launch scripts (start.sh, start.bat)",
              ]}
            />
          </div>
        </Section>

        {/* Built With */}
        <Section title="Built With">
          <div className="grid grid-cols-2 gap-3">
            <TechCard name="Next.js 16" desc="React framework with App Router" />
            <TechCard name="React 19" desc="UI component library" />
            <TechCard name="ReactFlow 12" desc="Node-based canvas engine" />
            <TechCard name="Zustand 5" desc="State management" />
            <TechCard name="Tailwind CSS 4" desc="Utility-first CSS" />
            <TechCard name="TypeScript 5.9" desc="Type-safe development" />
            <TechCard name="Google Gemini API" desc="LLM analysis &amp; prompt compilation" />
            <TechCard name="Nano Banana 2 / Pro" desc="AI image generation" />
            <TechCard name="Veo 3.1" desc="AI video generation" />
            <TechCard name="jose" desc="JWT authentication" />
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              Additional Providers (configurable)
            </p>
            <div className="flex flex-wrap gap-2">
              {["fal.ai", "Replicate", "WaveSpeed", "Kie.ai", "OpenAI", "Anthropic"].map(p => (
                <span key={p} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* License */}
        <Section title="License">
          <p>
            AGENT 1 is built on Node Banana (MIT License). The AGENT 1 modifications are by Sergio Valsecchi.
          </p>
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            Original Node Banana code: MIT License — free to use, modify, and distribute.
          </p>
        </Section>

        {/* Footer */}
        <div className="mt-16 pt-6 text-center text-xs" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          AGENT 1 — From Vision to Form · <a href="https://linkedin.com/in/valsecchisergio/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>Sergio Valsecchi</a> · 2026
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--accent)' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

function TechCard({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</div>
    </div>
  );
}

interface AuthorLink {
  type: "linkedin" | "twitter" | "discord" | "patreon" | "website";
  url: string;
  label: string;
}

function AuthorCard({
  initials, initialsColor, initialsBg, name, role, bio, badge, links
}: {
  initials: string;
  initialsColor: string;
  initialsBg: string;
  name: string;
  role: string;
  bio: string;
  badge?: string;
  links: AuthorLink[];
}) {
  const iconMap: Record<string, React.ReactNode> = {
    linkedin: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    twitter: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    discord: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    patreon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524zM.003 23.537h4.22V.524H.003"/>
      </svg>
    ),
    website: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
      </svg>
    ),
  };

  const colorMap: Record<string, { bg: string; text: string }> = {
    linkedin: { bg: "#0A66C2", text: "#ffffff" },
    twitter: { bg: "#000000", text: "#ffffff" },
    discord: { bg: "#5865F2", text: "#ffffff" },
    patreon: { bg: "#FF424D", text: "#ffffff" },
    website: { bg: "var(--surface-3)", text: "var(--text-primary)" },
  };

  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: initialsBg, color: initialsColor }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h3>
          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{role}</p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {bio}
          </p>
          {badge && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{badge}</p>
          )}
        </div>
      </div>

      {/* Social links */}
      {links.length > 0 && (
        <div className="flex gap-2 mt-4 pl-[72px]">
          {links.map((link) => {
            const colors = colorMap[link.type] || colorMap.website;
            return (
              <a
                key={link.type}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: colors.bg, color: colors.text }}
              >
                {iconMap[link.type]}
                {link.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReleaseEntry({ version, date, current, changes }: { version: string; date: string; current?: boolean; changes: string[] }) {
  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--surface-2)', border: current ? '1px solid var(--accent)' : '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{version}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{date}</span>
        {current && (
          <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }} >
            Current
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {changes.map((change, i) => (
          <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)' }}>+</span>
            {change}
          </li>
        ))}
      </ul>
    </div>
  );
}
