"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import "./login.css";
import { LoginAudio } from "./LoginAudio";
import { LoginForm } from "./LoginForm";
import { LoginTunnel } from "./LoginTunnel";
import { LoginUI } from "./LoginUI";

const SCHEMES = ["ignite", "aurora", "ember", "matrix", "sienna", "sage", "orchid", "platinum", "abyss", "amber", "ocean", "flux", "neon", "svelte", "cobalt", "coral", "moss", "zinc", "indigo", "rose", "carbon"];

export default function LoginPage() {
  const [musicFiles, setMusicFiles] = useState<string[]>([]);
  const [audioData, setAudioData] = useState<Uint8Array<ArrayBufferLike> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [scheme, setScheme] = useState("ignite");
  const userPickedRef = useRef(false);

  useEffect(() => {
    fetch("/api/login-assets")
      .then((r) => r.json())
      .then((data) => {
        console.log("[LoginPage] login-assets response:", data);
        setMusicFiles(data.music || []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const handleAudioData = useCallback((data: Uint8Array<ArrayBufferLike> | null) => {
    setAudioData(data);
  }, []);

  // Auto-rotate skin every 5s until user picks one
  useEffect(() => {
    if (userPickedRef.current) return; // Stop rotation if user picked

    const interval = setInterval(() => {
      setScheme((prev) => {
        const currentIndex = SCHEMES.indexOf(prev);
        const nextIndex = (currentIndex + 1) % SCHEMES.length;
        return SCHEMES[nextIndex];
      });
    }, 18000);

    return () => clearInterval(interval);
  }, []);

  // Handle scheme change from LoginForm (user picked)
  const handleSchemeChange = (newScheme: string) => {
    userPickedRef.current = true;
    setScheme(newScheme);
  };

  // Apply color scheme to document
  useEffect(() => {
    document.documentElement.setAttribute("data-login-scheme", scheme);
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.setAttribute("data-skin", scheme);
    return () => {
      document.documentElement.removeAttribute("data-login-scheme");
    };
  }, [scheme]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden relative bg-[#0a0e14]">
      {/* Layer 0: Data Tunnel background */}
      <LoginTunnel scheme={scheme} audioData={audioData} />
      {/* Layer 50: UI chrome */}
      <LoginUI />
      {/* Layer 999: Audio controls */}
      <LoginAudio musicFiles={musicFiles} onAudioData={handleAudioData} />
      {/* Layer 40: Login form */}
      <LoginForm scheme={scheme} onSchemeChange={handleSchemeChange} />
    </div>
  );
}
