"use client";

import { AlertCircle, Check } from "lucide-react";
import { useState } from "react";

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
              <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">{label}</label>
              {required && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent)]">Required</span>
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
