"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface LoginBackgroundProps {
  images: string[];
}

/**
 * Fullscreen background — images at 40% opacity (60% transparent)
 * for a darker atmosphere that makes particles/fog stand out.
 * Soft blur crossfade between images. Ken Burns continuous drift.
 */
export function LoginBackground({ images }: LoginBackgroundProps) {
  const [activeLayer, setActiveLayer] = useState<"A" | "B">("A");
  const [srcA, setSrcA] = useState("");
  const [srcB, setSrcB] = useState("");
  const [phase, setPhase] = useState<"idle" | "blurOut" | "blurIn">("idle");
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (images.length === 0) return;
    setSrcA(`/login/backgrounds/${images[0]}`);
    indexRef.current = 0;
  }, [images]);

  const advance = useCallback(() => {
    if (images.length <= 1 || phase !== "idle") return;
    const nextIdx = (indexRef.current + 1) % images.length;
    const nextSrc = `/login/backgrounds/${images[nextIdx]}`;
    indexRef.current = nextIdx;

    setPhase("blurOut");
    setTimeout(() => {
      if (activeLayer === "A") {
        setSrcB(nextSrc);
        setActiveLayer("B");
      } else {
        setSrcA(nextSrc);
        setActiveLayer("A");
      }
      setPhase("blurIn");
      setTimeout(() => setPhase("idle"), 1400);
    }, 1000);
  }, [activeLayer, images, phase]);

  useEffect(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(advance, 7000);
    return () => clearInterval(timerRef.current);
  }, [advance, images.length]);

  useEffect(() => {
    if (images.length <= 1) return;
    const nextIdx = (indexRef.current + 1) % images.length;
    const img = new Image();
    img.src = `/login/backgrounds/${images[nextIdx]}`;
  }, [images, activeLayer]);

  if (images.length === 0) {
    return (
      <div className="fixed inset-0 z-0 bg-[#0a0e14]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e14] via-[#0d1520] to-[#060a10]" />
      </div>
    );
  }

  const isBlurring = phase === "blurOut";
  const isSharpening = phase === "blurIn";

  // Active layer at 40% opacity (60% transparent); inactive at 0
  const layerOpacity = (isActive: boolean) => {
    if (!isActive) return 0;
    if (isBlurring) return 0.25; // dim further during transition
    return 0.4; // base: 60% transparent
  };

  const layerFilter = (isActive: boolean) => {
    if (!isActive) return "blur(0px)";
    if (isBlurring) return "blur(20px) brightness(0.5)";
    if (isSharpening) return "blur(0px) brightness(0.9)";
    return "blur(0px) brightness(0.9)";
  };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#0a0e14]">
      {srcA && (
        <img
          src={srcA}
          alt=""
          className="login-bg-layer login-kb-a"
          style={{
            opacity: layerOpacity(activeLayer === "A"),
            filter: layerFilter(activeLayer === "A"),
          }}
        />
      )}
      {srcB && (
        <img
          src={srcB}
          alt=""
          className="login-bg-layer login-kb-b"
          style={{
            opacity: layerOpacity(activeLayer === "B"),
            filter: layerFilter(activeLayer === "B"),
          }}
        />
      )}

      {/* Dark overlays for depth */}
      <div className="absolute inset-0 z-[3] bg-gradient-to-b from-black/40 via-transparent to-black/50" />
      <div className="absolute inset-0 z-[3]" style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 100%)"
      }} />
    </div>
  );
}
