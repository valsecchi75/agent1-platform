"use client";

import { useEffect, useRef } from "react";

interface FogPatch {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; alpha: number; phase: number;
}

interface LoginFogProps {
  audioData?: Uint8Array<ArrayBufferLike> | null;
  scheme?: string;
}

const SCHEME_HUES: Record<string, number> = {
  "essilor-luxottica": 45,
  "ray-ban": 360,
  "oakley": 350,
  "persol": 30,
  "oliver-peoples": 95,
  "vogue-eyewear": 295,
};

/**
 * Canvas 2D fog overlay — drifting cloud patches with scheme-colored tint.
 * Sits on top of the Three.js scene for atmospheric depth.
 */
export function LoginFog({ audioData, scheme = "essilor-luxottica" }: LoginFogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fogRef = useRef<FogPatch[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const FOG_COUNT = 16;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const fogHue = SCHEME_HUES[scheme] || 45;

    const createFog = (): FogPatch => {
      const w = window.innerWidth, h = window.innerHeight;
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.35,
        radius: 200 + Math.random() * 500,
        alpha: 0.035 + Math.random() * 0.06,
        phase: Math.random() * Math.PI * 2,
      };
    };

    resize();
    fogRef.current = Array.from({ length: FOG_COUNT }, createFog);

    const loop = () => {
      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      timeRef.current++;
      const t = timeRef.current;

      let pulse = 1;
      if (audioData && audioData.length > 0) {
        const avg = audioData.slice(0, 16).reduce((a, b) => a + b, 0) / 16;
        pulse = 1 + (avg / 255) * 0.6;
      }

      for (const f of fogRef.current) {
        f.x += f.vx + Math.sin(t * 0.002 + f.phase) * 0.4;
        f.y += f.vy + Math.cos(t * 0.0015 + f.phase) * 0.2;
        if (f.x < -f.radius) f.x = w + f.radius;
        if (f.x > w + f.radius) f.x = -f.radius;
        if (f.y < -f.radius) f.y = h + f.radius;
        if (f.y > h + f.radius) f.y = -f.radius;

        const breathe = 1 + Math.sin(t * 0.004 + f.phase) * 0.2;
        const r = f.radius * breathe;

        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        grad.addColorStop(0, `hsla(${fogHue}, 15%, 40%, ${f.alpha * pulse * 1.2})`);
        grad.addColorStop(0.35, `hsla(${fogHue}, 10%, 30%, ${f.alpha * pulse * 0.6})`);
        grad.addColorStop(0.7, `hsla(${fogHue}, 6%, 22%, ${f.alpha * pulse * 0.2})`);
        grad.addColorStop(1, `hsla(${fogHue}, 5%, 15%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [audioData, scheme]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[2]" />;
}
