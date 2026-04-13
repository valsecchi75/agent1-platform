"use client";

import { useEffect, useRef } from "react";

// Hue rotation per scheme — shifts the background colors toward the brand palette
const SCHEME_HUE_ROTATE: Record<string, number> = {
  "essilor-luxottica": 20,
  "ray-ban": 340,
  "oakley": 330,
  "persol": 25,
  "oliver-peoples": 90,
  "vogue-eyewear": 270,
};

interface LoginMouseEffectProps {
  scheme?: string;
}

/**
 * Large circle following the cursor that applies real backdrop-filter:
 * - blur (distorts the background image)
 * - hue-rotate (shifts colors based on current skin/scheme)
 * - brightness + saturate boost
 * Heavy lerp for smooth trailing movement. Disabled on touch devices.
 */
export function LoginMouseEffect({ scheme = "gold" }: LoginMouseEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -600, y: -600 });
  const smoothRef = useRef({ x: -600, y: -600 });
  const rafRef = useRef<number>(0);

  const hueRotate = SCHEME_HUE_ROTATE[scheme] || 20;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if ("ontouchstart" in window) {
      el.style.display = "none";
      return;
    }

    const RADIUS = 250;

    const update = () => {
      smoothRef.current.x += (posRef.current.x - smoothRef.current.x) * 0.06;
      smoothRef.current.y += (posRef.current.y - smoothRef.current.y) * 0.06;
      const { x, y } = smoothRef.current;
      el.style.transform = `translate(${x - RADIUS}px, ${y - RADIUS}px)`;
      rafRef.current = requestAnimationFrame(update);
    };

    const handleMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleLeave = () => {
      posRef.current = { x: -600, y: -600 };
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    rafRef.current = requestAnimationFrame(update);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const size = 500;

  return (
    <div
      ref={containerRef}
      className="fixed pointer-events-none z-10"
      style={{ width: size, height: size, willChange: "transform" }}
    >
      {/* Main effect: real backdrop blur + hue rotation + brightness */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backdropFilter: `blur(20px) hue-rotate(${hueRotate}deg) brightness(1.15) saturate(1.4)`,
          WebkitBackdropFilter: `blur(20px) hue-rotate(${hueRotate}deg) brightness(1.15) saturate(1.4)`,
          clipPath: "circle(50%)",
          mask: "radial-gradient(circle, black 30%, transparent 70%)",
          WebkitMask: "radial-gradient(circle, black 30%, transparent 70%)",
        }}
      />
      {/* Secondary ring — lighter blur, wider, for soft feathered edge */}
      <div
        className="absolute inset-[-15%] rounded-full"
        style={{
          backdropFilter: `blur(8px) hue-rotate(${Math.round(hueRotate * 0.5)}deg) brightness(1.05)`,
          WebkitBackdropFilter: `blur(8px) hue-rotate(${Math.round(hueRotate * 0.5)}deg) brightness(1.05)`,
          clipPath: "circle(50%)",
          mask: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.3) 60%, transparent 80%)",
          WebkitMask: "radial-gradient(circle, transparent 40%, rgba(0,0,0,0.3) 60%, transparent 80%)",
        }}
      />
      {/* Accent glow overlay */}
      <div
        className="absolute inset-[5%] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(var(--login-accent-rgb, 197,164,78), 0.06) 0%, transparent 60%)`,
        }}
      />
    </div>
  );
}
