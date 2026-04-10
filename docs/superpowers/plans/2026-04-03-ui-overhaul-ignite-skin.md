# UI Overhaul: Ignite Skin, Login Redesign, Modal Unification & Onboarding Wizard

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new "Ignite" primary skin (black + orange), redesign the login page with agno.com-inspired clean typography and blinking cursor, unify all modals to use CSS variables, and build a 6-step onboarding wizard.

**Architecture:** Four independent workstreams that share the CSS variable system in `globals.css`. Task 1 (Ignite skin) establishes the new color palette. Task 2 (login redesign) applies the new typography style. Task 3 (modal unification) replaces hardcoded colors with CSS vars. Task 4 (wizard) adds a new component tree. Each task produces a working commit.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI Dialog, Zustand, Inter font (already loaded), CSS custom properties.

---

## File Structure

### New Files
- `src/app/globals.css` — MODIFY: add Ignite skin + blinking cursor keyframes
- `src/app/login/login.css` — MODIFY: add Ignite login scheme + cursor animation
- `src/app/login/LoginUI.tsx` — MODIFY: Inter font, agno-style layout, blinking `_`
- `src/app/login/LoginForm.tsx` — MODIFY: add Ignite to SCHEMES, Inter font, clean inputs
- `src/app/login/page.tsx` — MODIFY: default scheme → "ignite"
- `src/app/layout.tsx` — MODIFY: add Inter weight 700
- `src/components/onboarding/OnboardingWizard.tsx` — CREATE: wizard container
- `src/components/onboarding/steps/WelcomeStep.tsx` — CREATE
- `src/components/onboarding/steps/ApiKeysStep.tsx` — CREATE
- `src/components/onboarding/steps/CanvasStep.tsx` — CREATE
- `src/components/onboarding/steps/NodesStep.tsx` — CREATE
- `src/components/onboarding/steps/ReportsStep.tsx` — CREATE
- `src/components/onboarding/steps/ProTipsStep.tsx` — CREATE
- `src/store/onboardingStore.ts` — CREATE: wizard state (Zustand)

### Modified Files (Modal Unification)
- `src/components/KeyboardShortcutsDialog.tsx` — replace hardcoded neutral-* with CSS vars
- `src/components/AnnotationModal.tsx` — replace hardcoded neutral-* with CSS vars
- `src/components/SplitGridSettingsModal.tsx` — replace hardcoded colors
- `src/components/SaveAsTemplateModal.tsx` — replace hardcoded colors
- `src/components/modals/PromptEditorModal.tsx` — replace hardcoded colors
- `src/components/modals/PromptConstructorEditorModal.tsx` — replace hardcoded colors
- `src/components/modals/ModelSearchDialog.tsx` — replace hardcoded colors
- `src/components/quickstart/WelcomeModal.tsx` — replace hardcoded colors
- `src/components/ProjectSetupModal.tsx` — replace hardcoded colors

---

## Task 1: Create "Ignite" Skin (Black + Orange)

**Files:**
- Modify: `src/app/globals.css` (append after last skin block)
- Modify: `src/app/login/login.css` (add ignite login scheme)
- Modify: `src/app/login/LoginForm.tsx:8-19` (add Ignite to SCHEMES array)

**Design Reference (agno.com-inspired):**
- Background: Pure black `#0a0a0a`
- Surfaces: `#111111`, `#181818`, `#222222`
- Accent: Warm orange `#E8530E` (inspired by agno #ff4017, slightly muted for UI)
- Accent hover: `#FF6B2B`
- Accent vivid: `#FF8040`
- Text: White `#f0f0f0`, secondary `#888888`, muted `#555555`
- Borders: `#222222`, subtle `#1a1a1a`
- Font: Inter (already loaded)

- [ ] **Step 1: Add Ignite dark skin to globals.css**

Append this block after the last skin definition (after ocean light theme block). Find the end of the last `html[data-theme="light"][data-skin="ocean"]` block and add after it:

```css
/* ── Ignite — Pure black, warm orange, agno-inspired minimal ── */
html[data-skin="ignite"] {
  --tw-neutral-50:  #f0f0f0;
  --tw-neutral-100: #d0d0d0;
  --tw-neutral-200: #999999;
  --tw-neutral-300: #777777;
  --tw-neutral-400: #555555;
  --tw-neutral-500: #444444;
  --tw-neutral-600: #333333;
  --tw-neutral-700: #222222;
  --tw-neutral-800: #151515;
  --tw-neutral-900: #0e0e0e;
  --tw-neutral-950: #080808;

  --background: #080808;
  --foreground: #f0f0f0;
  --canvas-bg: #0a0a0a;

  --surface-1: #0e0e0e;
  --surface-2: #151515;
  --surface-3: #1e1e1e;
  --border: #252525;
  --border-subtle: #1a1a1a;

  --text-primary: #f0f0f0;
  --text-secondary: #999999;
  --text-muted: #555555;

  --accent: #E8530E;
  --accent-hover: #FF6B2B;
  --accent-vivid: #FF8040;
  --accent-subtle: rgba(232, 83, 14, 0.12);

  --header-bg: #080808;
  --header-border: #1a1a1a;

  --node-bg: #0e0e0e;
  --node-border: #252525;
  --node-header: #151515;

  --controls-bg: #151515;
  --controls-border: #252525;
  --controls-hover: #1e1e1e;

  --edge-color: #333333;
  --edge-selected: #E8530E;

  --modal-bg: #0e0e0e;
  --modal-border: #252525;
  --input-bg: #0a0a0a;
  --input-border: #252525;
  --input-focus: #444444;
  --scrollbar-track: #0e0e0e;
  --scrollbar-thumb: #333333;
  --scrollbar-thumb-hover: #444444;
  --btn-secondary-bg: #1e1e1e;
  --btn-secondary-text: #999999;
  --btn-hover: #282828;
  --btn-primary-text: #ffffff;
}

html[data-theme="light"][data-skin="ignite"] {
  --tw-neutral-50:  #111111;
  --tw-neutral-100: #1a1a1a;
  --tw-neutral-200: #333333;
  --tw-neutral-300: #555555;
  --tw-neutral-400: #777777;
  --tw-neutral-500: #888888;
  --tw-neutral-600: #aaaaaa;
  --tw-neutral-700: #d0d0d0;
  --tw-neutral-800: #f0f0f0;
  --tw-neutral-900: #f8f8f8;
  --tw-neutral-950: #fcfcfc;

  --background: #fcfcfc;
  --foreground: #111111;
  --canvas-bg: #f0f0f0;
  --surface-1: #ffffff;
  --surface-2: #f8f8f8;
  --surface-3: #f0f0f0;
  --border: #e0e0e0;
  --text-primary: #111111;
  --text-secondary: #555555;
  --text-muted: #888888;
  --accent: #C0440A;
  --accent-hover: #D85010;
  --accent-vivid: #E86020;
  --header-bg: #ffffff;
  --header-border: #e8e8e8;
  --node-bg: #ffffff;
  --node-border: #e0e0e0;
  --controls-bg: #ffffff;
  --controls-border: #e0e0e0;
  --controls-hover: #f0f0f0;

  --modal-bg: #ffffff;
  --modal-border: #e0e0e0;
  --input-bg: #f8f8f8;
  --input-border: #e0e0e0;
  --input-focus: #aaaaaa;
  --scrollbar-track: #f0f0f0;
  --scrollbar-thumb: #cccccc;
  --scrollbar-thumb-hover: #aaaaaa;
  --btn-secondary-bg: #f0f0f0;
  --btn-secondary-text: #555555;
  --btn-hover: #e8e8e8;
  --edge-color: #cccccc;
  --edge-selected: #C0440A;

  --btn-primary-text: #ffffff;
}
```

- [ ] **Step 2: Add Ignite login scheme to login.css**

After the `[data-login-scheme="ocean"]` block, add:

```css
/* Ignite — warm orange */
[data-login-scheme="ignite"] {
  --login-accent: #E8530E;
  --login-accent-rgb: 232, 83, 14;
  --login-glow: rgba(232, 83, 14, 0.4);
  --login-glow-soft: rgba(232, 83, 14, 0.12);
}
```

- [ ] **Step 3: Add Ignite to LoginForm SCHEMES array**

In `src/app/login/LoginForm.tsx`, add to the SCHEMES array (insert as first item to make it default):

```typescript
const SCHEMES = [
  { id: "ignite", label: "Ignite", color: "#E8530E" },
  { id: "aurora", label: "Aurora", color: "#c5a44e" },
  // ... rest stays the same
];
```

- [ ] **Step 4: Set Ignite as default scheme in login page**

In `src/app/login/page.tsx`, change line 16:
```typescript
const [scheme, setScheme] = useState("ignite");
```

And update the SCHEMES array at line 10 to include "ignite" as first element:
```typescript
const SCHEMES = ["ignite", "aurora", "ember", "matrix", "sienna", "sage", "orchid", "platinum", "abyss", "amber", "ocean"];
```

- [ ] **Step 5: Verify the skin renders correctly**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/login/login.css src/app/login/LoginForm.tsx src/app/login/page.tsx
git commit -m "feat: add Ignite skin — pure black + orange accent, agno-inspired palette"
```

---

## Task 2: Login Page Redesign (agno.com-inspired)

**Files:**
- Modify: `src/app/login/LoginUI.tsx` — new typography layout with blinking cursor
- Modify: `src/app/login/login.css` — add cursor blink keyframe
- Modify: `src/app/layout.tsx:22` — ensure Inter weight 700 is loaded

**Design:**
- Top-right: "agent 1" + subtitle with blinking `_` cursor (like agno.com/about hero)
- Font: Inter (replace Arimo), weights 200-600
- Clean, minimal layout — no Arimo inline styles
- Blinking cursor: orange `_` that fades in/out every 0.5s (GSAP-style with CSS)
- All text uses Inter via CSS, not inline fontFamily

- [ ] **Step 1: Add blinking cursor keyframe to login.css**

Add at the end of `src/app/login/login.css`:

```css
/* ── Blinking cursor (agno-style) ── */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.blinking-cursor {
  display: inline-block;
  animation: cursor-blink 1s step-end infinite;
  color: var(--login-accent);
  font-weight: 200;
  margin-left: 1px;
}
```

- [ ] **Step 2: Redesign LoginUI.tsx with Inter font and blinking cursor**

Replace the entire content of `src/app/login/LoginUI.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { playHoverSound } from "./LoginAudio";

const hover = "cursor-default hover:opacity-100 transition-opacity duration-150";
const onHover = () => playHoverSound();

export function LoginUI() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      {/* ── Top right — Brand claim (Inter) ── */}
      <div className="fixed top-8 right-10 z-50 select-none text-right font-[family-name:var(--font-inter)]">
        <p className="text-white tracking-[0.02em] leading-tight login-flicker font-light" style={{ fontSize: "2.2em", "--flicker-delay": "0s" } as React.CSSProperties}>
          <span className={hover} onMouseEnter={onHover}>agent 1</span>
          <span className="blinking-cursor">_</span>
        </p>
        <p className="text-white/30 tracking-[0.04em] login-flicker font-extralight mt-1" style={{ fontSize: "0.85em", "--flicker-delay": "0.5s" } as React.CSSProperties}>
          <span className={`opacity-70 ${hover}`} onMouseEnter={onHover}>from vision to form</span>
        </p>
      </div>

      {/* ── Top left — Contact ── */}
      <div className="fixed top-8 left-10 z-50 flex items-center gap-4">
        <button
          onClick={() => setContactOpen(true)}
          onMouseEnter={onHover}
          className="text-white/40 hover:text-white/80 text-[0.7em] tracking-[0.15em] uppercase transition-colors cursor-pointer font-light"
        >
          Contact
        </button>
      </div>

      {/* ── Bottom left — Tagline ── */}
      <div className="fixed bottom-8 left-10 z-50 select-none">
        <p className="text-white/20 tracking-[0.08em] font-light" style={{ fontSize: "0.72em" }}>
          <span className={hover} onMouseEnter={onHover}>connect</span>{" "}
          <span className="opacity-50">any api.</span>{" "}
          <span className={hover} onMouseEnter={onHover}>build</span>{" "}
          <span className="opacity-50">any workflow.</span>{" "}
          <span className={hover} onMouseEnter={onHover}>generate</span>{" "}
          <span className="opacity-50">anything.</span>
        </p>
      </div>

      {/* ── Bottom right — Footer ── */}
      <div className="fixed bottom-8 right-10 z-50 select-none text-right">
        <p className="text-white/20 uppercase tracking-[0.12em] font-mono" style={{ fontSize: "0.5em" }}>
          <span className={hover} onMouseEnter={onHover}>2026</span>{" "}
          <span className={hover} onMouseEnter={onHover}>&copy;</span>{" "}
          <a href="https://linkedin.com/in/valsecchisergio/" target="_blank" rel="noopener noreferrer" className={hover} onMouseEnter={onHover}>
            Sergio Valsecchi
          </a>
        </p>
      </div>

      {/* ── Contact popup ── */}
      {contactOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center contact-entering" onClick={() => setContactOpen(false)}>
          <div className="flex flex-col items-center gap-8" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setContactOpen(false)}
              onMouseEnter={onHover}
              className="fixed top-8 right-10 text-white/40 hover:text-white text-[0.65em] uppercase tracking-[0.25em] transition-colors duration-200 cursor-pointer font-light"
            >
              Close
            </button>

            <ul className="text-white text-center space-y-5" style={{ fontSize: "1.1em" }}>
              <li>
                <a href="mailto:sergio@kframeinteractive.com" target="_blank" rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-50 transition-all duration-200 py-2 inline-block uppercase tracking-[0.25em] hover:tracking-[0.3em] font-light">
                  Email
                </a>
              </li>
              <li>
                <a href="https://linkedin.com/in/valsecchisergio/" target="_blank" rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-50 transition-all duration-200 py-2 inline-block uppercase tracking-[0.25em] hover:tracking-[0.3em] font-light">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="https://instagram.com/wall__ai/" target="_blank" rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-50 transition-all duration-200 py-2 inline-block uppercase tracking-[0.25em] hover:tracking-[0.3em] font-light">
                  Instagram
                </a>
              </li>
            </ul>

            <p className="text-white/10 text-[0.5em] uppercase tracking-[0.2em] font-mono mt-6">
              sergio@kframeinteractive.com
            </p>
          </div>
        </div>
      )}
    </>
  );
}
```

Key changes from current:
- Brand claim moved to **top-right** (was top-left)
- Font changed from Arimo to Inter via Tailwind class
- Blinking `_` cursor after "agent 1" (agno-style)
- Subtitle simplified: just "from vision to form" on one clean line
- Contact moved to **top-left** (was top-right) — mirror swap
- Tagline ("connect any api...") moved to bottom-left
- Footer simplified, bottom-right
- All font-weights use Tailwind (font-light, font-extralight) not inline styles

- [ ] **Step 3: Update LoginForm.tsx input styles**

In `src/app/login/LoginForm.tsx`, update the `inputClass` string (line 75-76) to use Inter explicitly:

```typescript
const inputClass =
  "w-full pl-10 pr-4 py-3 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10 transition-colors font-light tracking-wide";
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/login/LoginUI.tsx src/app/login/LoginForm.tsx src/app/login/login.css
git commit -m "feat: redesign login page — Inter font, agno-inspired layout, blinking cursor"
```

---

## Task 3: Modal Unification (Replace Hardcoded Colors)

**Goal:** Replace all hardcoded `neutral-*`, `bg-neutral-*`, `text-neutral-*`, `border-neutral-*` classes with CSS variable equivalents using the existing design token system.

**Mapping guide:**
| Hardcoded Class | CSS Variable Replacement |
|---|---|
| `bg-neutral-950`, `bg-neutral-900` | `bg-[var(--modal-bg)]` or `bg-[var(--surface-1)]` |
| `bg-neutral-800` | `bg-[var(--surface-2)]` |
| `bg-neutral-700` | `bg-[var(--surface-3)]` or `border-[var(--border)]` |
| `text-neutral-100` | `text-[var(--text-primary)]` |
| `text-neutral-300`, `text-neutral-400` | `text-[var(--text-secondary)]` |
| `text-neutral-500` | `text-[var(--text-muted)]` |
| `border-neutral-700`, `border-neutral-600` | `border-[var(--border)]` |
| `divide-neutral-700` | `divide-[var(--border)]` |
| `hover:bg-neutral-700` | `hover:bg-[var(--btn-hover)]` |

- [ ] **Step 1: Fix KeyboardShortcutsDialog.tsx**

File: `src/components/KeyboardShortcutsDialog.tsx`

Replace all hardcoded colors. This dialog uses `bg-neutral-800`, `text-neutral-100`, `border-neutral-700`, etc. Apply the mapping above throughout the file.

- [ ] **Step 2: Fix AnnotationModal.tsx**

File: `src/components/AnnotationModal.tsx`

Replace `bg-neutral-950`, `bg-neutral-900`, `bg-neutral-800`, `text-neutral-*` with CSS variables. This is the fullscreen modal — keep its fullscreen layout but fix colors.

- [ ] **Step 3: Fix SplitGridSettingsModal.tsx**

File: `src/components/SplitGridSettingsModal.tsx`

Replace hardcoded `neutral-800`, `neutral-700`, `neutral-900`, `neutral-100` with CSS variables.

- [ ] **Step 4: Fix SaveAsTemplateModal.tsx**

File: `src/components/SaveAsTemplateModal.tsx`

Replace hardcoded `neutral-900`, `neutral-700`, `neutral-100` with CSS variables.

- [ ] **Step 5: Fix PromptEditorModal.tsx**

File: `src/components/modals/PromptEditorModal.tsx`

Replace hardcoded neutral colors with CSS variables.

- [ ] **Step 6: Fix PromptConstructorEditorModal.tsx**

File: `src/components/modals/PromptConstructorEditorModal.tsx`

Replace hardcoded neutral colors with CSS variables.

- [ ] **Step 7: Fix ModelSearchDialog.tsx**

File: `src/components/modals/ModelSearchDialog.tsx`

Replace hardcoded neutral colors. Note: provider badge colors (blue for OpenAI, etc.) should stay as-is — those are semantic, not theme colors.

- [ ] **Step 8: Fix WelcomeModal.tsx and QuickStart views**

File: `src/components/quickstart/WelcomeModal.tsx` and related views

Replace hardcoded colors with CSS variables.

- [ ] **Step 9: Fix ProjectSetupModal.tsx**

File: `src/components/ProjectSetupModal.tsx`

Replace hardcoded colors with CSS variables.

- [ ] **Step 10: Verify all skins render modals correctly**

Manually test (or build check): switch between ignite, aurora, ember skins and verify modals look correct in each.

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 11: Commit**

```bash
git add src/components/KeyboardShortcutsDialog.tsx src/components/AnnotationModal.tsx \
  src/components/SplitGridSettingsModal.tsx src/components/SaveAsTemplateModal.tsx \
  src/components/modals/PromptEditorModal.tsx src/components/modals/PromptConstructorEditorModal.tsx \
  src/components/modals/ModelSearchDialog.tsx src/components/quickstart/WelcomeModal.tsx \
  src/components/ProjectSetupModal.tsx
git commit -m "fix: unify all modals to use CSS variables instead of hardcoded colors"
```

---

## Task 4: Onboarding Wizard

**Files:**
- Create: `src/store/onboardingStore.ts`
- Create: `src/components/onboarding/OnboardingWizard.tsx`
- Create: `src/components/onboarding/steps/WelcomeStep.tsx`
- Create: `src/components/onboarding/steps/ApiKeysStep.tsx`
- Create: `src/components/onboarding/steps/CanvasStep.tsx`
- Create: `src/components/onboarding/steps/NodesStep.tsx`
- Create: `src/components/onboarding/steps/ReportsStep.tsx`
- Create: `src/components/onboarding/steps/ProTipsStep.tsx`
- Modify: `src/app/layout.tsx` — mount wizard component
- Modify: `src/components/Header.tsx` — add "Restart Tutorial" in settings menu

**Design:**
- Container: centered, `max-w-[720px]`, `min-h-[480px]`, bg-[var(--modal-bg)]
- Progress: 6 dot indicators at bottom
- Navigation: "Back" (secondary) + "Next" (primary) + "Skip" (text link top-right)
- Slide transition between steps
- Stored in localStorage key `agent1_onboarding_completed`
- Uses CSS variables throughout (theme-aware)
- All text in English

- [ ] **Step 1: Create onboarding Zustand store**

Create `src/store/onboardingStore.ts`:

```typescript
import { create } from "zustand";

interface OnboardingState {
  showWizard: boolean;
  currentStep: number;
  totalSteps: number;
  setShowWizard: (show: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeWizard: () => void;
  resetWizard: () => void;
  checkShouldShow: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  showWizard: false,
  currentStep: 0,
  totalSteps: 6,

  setShowWizard: (show) => set({ showWizard: show }),

  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps - 1) {
      set({ currentStep: currentStep + 1 });
    } else {
      get().completeWizard();
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  },

  goToStep: (step) => set({ currentStep: step }),

  completeWizard: () => {
    localStorage.setItem("agent1_onboarding_completed", "true");
    set({ showWizard: false, currentStep: 0 });
  },

  resetWizard: () => {
    localStorage.removeItem("agent1_onboarding_completed");
    set({ showWizard: true, currentStep: 0 });
  },

  checkShouldShow: () => {
    const completed = localStorage.getItem("agent1_onboarding_completed");
    if (!completed) {
      set({ showWizard: true, currentStep: 0 });
    }
  },
}));
```

- [ ] **Step 2: Create WelcomeStep.tsx**

Create `src/components/onboarding/steps/WelcomeStep.tsx`:

```tsx
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
```

- [ ] **Step 3: Create ApiKeysStep.tsx**

Create `src/components/onboarding/steps/ApiKeysStep.tsx`:

A simplified version of ApiKeyPanel showing the 3 most important providers (Gemini, OpenAI, Replicate) with inline validation. Shows "You can add more providers later in Settings" at the bottom.

```tsx
"use client";

import { useState } from "react";
import { Check, AlertCircle } from "lucide-react";

const PROVIDERS = [
  { key: "GEMINI_API_KEY", label: "Google Gemini", required: true, hint: "Required for image generation" },
  { key: "OPENAI_API_KEY", label: "OpenAI", required: false, hint: "For GPT text generation" },
  { key: "REPLICATE_API_KEY", label: "Replicate", required: false, hint: "For Flux, SDXL models" },
];

export function ApiKeysStep() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const handleSave = async (keyName: string) => {
    const value = keys[keyName];
    if (!value?.trim()) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyName, value: value.trim() }),
      });
      if (res.ok) setSaved((s) => ({ ...s, [keyName]: true }));
    } catch { /* silent */ }
  };

  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">
        Connect your AI providers
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        At least one API key is needed to start generating. You can add more later in Settings.
      </p>

      <div className="space-y-4">
        {PROVIDERS.map(({ key, label, required, hint }) => (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">
                {label}
              </label>
              {required && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)]">
                  Required
                </span>
              )}
              {saved[key] && <Check className="w-3.5 h-3.5 text-emerald-500" />}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={`Paste your ${label} key`}
                value={keys[key] || ""}
                onChange={(e) => setKeys((k) => ({ ...k, [key]: e.target.value }))}
                className="flex-1 px-3 py-2 text-xs rounded-md bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors font-light"
              />
              <button
                onClick={() => handleSave(key)}
                disabled={!keys[key]?.trim()}
                className="px-3 py-2 text-xs rounded-md bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-hover)] disabled:opacity-30 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 font-light">{hint}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-6 text-[10px] text-[var(--text-muted)]">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>Keys are stored locally on your machine. Never shared externally.</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create CanvasStep.tsx**

Create `src/components/onboarding/steps/CanvasStep.tsx`:

Visual explainer of the canvas — uses a static illustration/diagram showing the canvas areas.

```tsx
"use client";

export function CanvasStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">
        The Canvas
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        This is your creative workspace. Drag, connect, and run.
      </p>

      {/* Visual diagram */}
      <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-6 min-h-[260px]">
        {/* Header bar mock */}
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
```

- [ ] **Step 5: Create NodesStep.tsx**

Create `src/components/onboarding/steps/NodesStep.tsx`:

```tsx
"use client";

const NODE_TYPES = [
  { icon: "T", label: "Prompt", desc: "Text input for AI instructions", color: "#4a90d9" },
  { icon: "🖼", label: "Image Input", desc: "Load reference images", color: "#10b981" },
  { icon: "⚡", label: "Generate Image", desc: "AI image generation (Gemini, SDXL, Flux...)", color: "#E8530E" },
  { icon: "💬", label: "LLM Generate", desc: "AI text with GPT, Gemini, Claude", color: "#8b5cf6" },
  { icon: "🎬", label: "Generate Video", desc: "AI video from text or image", color: "#ec4899" },
  { icon: "📊", label: "Output", desc: "Display and save final results", color: "#6b7280" },
];

export function NodesStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">
        Your Building Blocks
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        Nodes are the core of every workflow. Connect them to build generation pipelines.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {NODE_TYPES.map(({ icon, label, desc, color }) => (
          <div
            key={label}
            className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-sm shrink-0"
              style={{ backgroundColor: `${color}18`, color }}
            >
              {icon}
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-[var(--text-muted)] mt-4 text-center font-light">
        More node types available via the Node Pack Manager
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Create ReportsStep.tsx**

Create `src/components/onboarding/steps/ReportsStep.tsx`:

```tsx
"use client";

import { BarChart3, Heart, DollarSign, Clock } from "lucide-react";

const FEATURES = [
  { icon: Heart, label: "Favorites", desc: "Mark your best generations to find them fast" },
  { icon: DollarSign, label: "Cost Tracking", desc: "Monitor API spend per workflow and provider" },
  { icon: BarChart3, label: "Usage Reports", desc: "Visualize your generation activity over time" },
  { icon: Clock, label: "History", desc: "Browse and reload any previous generation" },
];

export function ReportsStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">
        Track Your Creations
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        Every generation is saved automatically. Review, favorite, and analyze your work.
      </p>

      <div className="space-y-3">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
            <Icon className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-light">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create ProTipsStep.tsx**

Create `src/components/onboarding/steps/ProTipsStep.tsx`:

```tsx
"use client";

import { Keyboard, Save, Sparkles, Users } from "lucide-react";

const TIPS = [
  { icon: Keyboard, title: "Keyboard Shortcuts", desc: "Press ? to see all shortcuts. Ctrl+Enter runs the workflow." },
  { icon: Save, title: "Save as Template", desc: "Save your best workflows as reusable templates." },
  { icon: Sparkles, title: "AI Quickstart", desc: "Describe what you want — AI builds the workflow for you." },
  { icon: Users, title: "Community Workflows", desc: "Browse and install workflows shared by other users." },
];

export function ProTipsStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">
        You&apos;re Ready
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        A few tips to get the most out of Agent 1.
      </p>

      <div className="space-y-3">
        {TIPS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border)]">
            <Icon className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">{title}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-[var(--text-secondary)] font-light">
          You can restart this tutorial anytime from <span className="text-[var(--accent)]">Settings</span>.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create OnboardingWizard.tsx container**

Create `src/components/onboarding/OnboardingWizard.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useOnboardingStore } from "@/store/onboardingStore";
import { WelcomeStep } from "./steps/WelcomeStep";
import { ApiKeysStep } from "./steps/ApiKeysStep";
import { CanvasStep } from "./steps/CanvasStep";
import { NodesStep } from "./steps/NodesStep";
import { ReportsStep } from "./steps/ReportsStep";
import { ProTipsStep } from "./steps/ProTipsStep";

const STEPS = [
  { component: WelcomeStep, label: "Welcome" },
  { component: ApiKeysStep, label: "API Keys" },
  { component: CanvasStep, label: "Canvas" },
  { component: NodesStep, label: "Nodes" },
  { component: ReportsStep, label: "Reports" },
  { component: ProTipsStep, label: "Tips" },
];

export function OnboardingWizard() {
  const { showWizard, currentStep, nextStep, prevStep, completeWizard, checkShouldShow } =
    useOnboardingStore();

  useEffect(() => {
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
        {/* Skip link — top right */}
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

        {/* Footer: dots + navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
          {/* Dot indicators */}
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

          {/* Nav buttons */}
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
```

- [ ] **Step 9: Mount wizard in layout.tsx**

In `src/app/layout.tsx`, import and add after `<Toast />`:

```tsx
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

// In the body:
<Toast />
<OnboardingWizard />
```

**Important:** The wizard should only appear on the main app page (not login). Move the mount to the main page component instead if needed — check if `layout.tsx` renders on login too. If it does, add a check in OnboardingWizard: if `window.location.pathname === '/login'` skip rendering.

- [ ] **Step 10: Add "Restart Tutorial" to Header settings**

In `src/components/Header.tsx`, find the settings dropdown menu and add a new item:

```tsx
import { useOnboardingStore } from "@/store/onboardingStore";

// Inside settings dropdown:
<button onClick={() => useOnboardingStore.getState().resetWizard()}>
  Restart Tutorial
</button>
```

- [ ] **Step 11: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 12: Commit**

```bash
git add src/store/onboardingStore.ts src/components/onboarding/ src/app/layout.tsx src/components/Header.tsx
git commit -m "feat: add 6-step onboarding wizard — skippable, first-time only, theme-aware"
```

---

## Task 5: Verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```
Expected: 0 errors

- [ ] **Step 2: Run linting**

```bash
npm run lint
```
Expected: 0 errors (or only pre-existing warnings)

- [ ] **Step 3: Manual verification checklist**

- [ ] Ignite skin renders correctly in dark mode
- [ ] Ignite skin renders correctly in light mode
- [ ] Login page shows "agent 1_" with blinking cursor in top-right
- [ ] Login page uses Inter font (no Arimo)
- [ ] All 10 original skins still work on login
- [ ] KeyboardShortcutsDialog renders in light mode (was broken)
- [ ] AnnotationModal renders in light mode (was broken)
- [ ] Wizard shows on first visit (clear localStorage to test)
- [ ] Wizard can be skipped
- [ ] Wizard doesn't show on second visit
- [ ] "Restart Tutorial" in settings re-opens wizard
- [ ] All 6 wizard steps display correctly
- [ ] API key step can save keys
