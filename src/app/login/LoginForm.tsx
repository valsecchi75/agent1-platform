"use client";

import { User, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import { playHoverSound } from "./LoginAudio";
import { formatVersion } from "@/lib/appVersion";

const SCHEMES = [
  { id: "ignite", label: "Ignite", color: "#E8530E" },
  { id: "aurora", label: "Aurora", color: "#c5a44e" },
  { id: "ember", label: "Ember", color: "#D31920" },
  { id: "matrix", label: "Matrix", color: "#4CAF50" },
  { id: "sienna", label: "Sienna", color: "#8B572A" },
  { id: "sage", label: "Sage", color: "#6B705C" },
  { id: "orchid", label: "Orchid", color: "#7B2D8E" },
  { id: "platinum", label: "Platinum", color: "#A0A0A8" },
  { id: "abyss", label: "Abyss", color: "#1B3A5C" },
  { id: "amber", label: "Amber", color: "#B8860B" },
  { id: "ocean", label: "Ocean", color: "#008B8B" },
  { id: "flux", label: "Flux", color: "#FF0072" },
  { id: "neon", label: "Neon", color: "#61DAFB" },
  { id: "svelte", label: "Svelte", color: "#FF3E00" },
  { id: "cobalt", label: "Cobalt", color: "#2979FF" },
  { id: "coral", label: "Coral", color: "#FF6B6B" },
  { id: "moss", label: "Moss", color: "#2D6A4F" },
  { id: "zinc", label: "Zinc", color: "#71717A" },
  { id: "indigo", label: "Indigo", color: "#6366F1" },
  { id: "rose", label: "Rose", color: "#E11D48" },
  { id: "carbon", label: "Carbon", color: "#F97316" },
];

interface LoginFormProps {
  scheme: string;
  onSchemeChange: (s: string) => void;
}

export function LoginForm({ scheme, onSchemeChange }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [glowState, setGlowState] = useState<"" | "glow-fast" | "glow-error">("");
  const [fading, setFading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('agent1-skin', scheme);
        setGlowState("glow-fast");
        // Simple dissolve: fade to dark, then navigate
        setTimeout(() => setFading(true), 300);
        setTimeout(() => {
          localStorage.setItem("agent1-transition", "pending");
          router.push("/");
        }, 1300);
        return;
      }

      setError(data.error || "Login failed");
      setShake(true);
      setGlowState("glow-error");
      setTimeout(() => { setShake(false); setGlowState(""); }, 500);
      setPassword("");
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full pl-10 pr-4 py-3 rounded-lg text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10 transition-colors font-light tracking-wide";

  return (
    <>
      {/* Fade-to-dark overlay on login success */}
      {fading && (
        <div
          className="fixed inset-0 z-[200]"
          style={{
            background: "#0a0e14",
            animation: "login-fade-out 1s ease-in-out forwards",
          }}
        />
      )}

      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div
          className={`login-glow ${glowState} ${shake ? "login-shake" : ""} pointer-events-auto`}
          style={{ width: 380 }}
        >
          <div
            className="relative z-10 p-8 login-form-inner"
            style={{
              borderRadius: "16px",
              background: "rgba(10, 14, 20, 0.85)",
              backdropFilter: "blur(24px) saturate(1.1)",
              WebkitBackdropFilter: "blur(24px) saturate(1.1)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Logo + Version */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <img src="/brands/A1-logo-neg.png" alt="Agent 1" className="h-10" />
              </div>
              <span
                className="inline-block text-[9px] font-medium tracking-wider uppercase px-2 py-0.5 rounded"
                style={{ background: "rgba(var(--login-accent-rgb), 0.12)", color: "var(--login-accent)" }}
              >
                {formatVersion()}
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className={inputClass}
                  autoFocus
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className={`${inputClass} pr-10`}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center py-1">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-3 rounded-lg font-medium text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:brightness-110 mt-2"
                style={{ background: "var(--login-accent)", color: "#0c0f14" }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Access
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* ── Color scheme selector — below Access button ── */}
            <div className="flex items-center justify-center gap-2.5 mt-5">
              {SCHEMES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSchemeChange(s.id)}
                  onMouseEnter={() => playHoverSound()}
                  title={s.label}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    scheme === s.id
                      ? "ring-1 ring-white/70 ring-offset-2 ring-offset-transparent scale-150"
                      : "opacity-40 hover:opacity-80 hover:scale-125"
                  }`}
                  style={{ background: s.color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
