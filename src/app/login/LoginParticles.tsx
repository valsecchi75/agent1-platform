"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number;
  originX: number; originY: number; // spawn point on edge
  speed: number; // individual speed to center
  progress: number; // 0=edge, 1=center
  size: number; hue: number; sat: number;
  alpha: number;
  offset: number; // lateral wobble offset
  wobbleAmp: number;
  wobbleFreq: number;
  trail: { x: number; y: number; a: number }[];
}

interface FogPatch {
  x: number; y: number;
  vx: number; vy: number;
  radius: number; alpha: number; phase: number;
}

interface LoginParticlesProps {
  audioData?: Uint8Array<ArrayBufferLike> | null;
  scheme?: string;
}

const SCHEME_HUES: Record<string, [number, number]> = {
  "essilor-luxottica": [35, 55],   // gold
  "ray-ban": [350, 370],           // red
  "oakley": [340, 360],            // red-magenta
  "persol": [20, 40],              // brown/amber
  "oliver-peoples": [80, 110],     // olive/sage
  "vogue-eyewear": [280, 310],     // purple
};

/**
 * Particles spawn on all 4 edges and travel in straight lines toward
 * screen center — like dust arriving from behind through a tunnel.
 * They leave soft blur trails and shift color as they approach.
 * Fog patches drift across for atmospheric depth.
 */
export function LoginParticles({ audioData, scheme = "gold" }: LoginParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const fogRef = useRef<FogPatch[]>([]);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const COUNT = 350;
    const FOG_COUNT = 16;
    const TRAIL_LEN = 10;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const [hueMin, hueMax] = SCHEME_HUES[scheme] || SCHEME_HUES.gold;

    const createParticle = (randomProgress = false): Particle => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2, cy = h / 2;

      // Spawn on a random point along the viewport perimeter
      const perim = 2 * (w + h);
      const p = Math.random() * perim;
      let ox: number, oy: number;
      if (p < w)          { ox = p;          oy = 0; }
      else if (p < w + h) { ox = w;          oy = p - w; }
      else if (p < 2*w+h) { ox = 2*w+h - p;  oy = h; }
      else                { ox = 0;           oy = perim - p; }

      // Push origin slightly outside viewport for cleaner entry
      const dx = ox - cx, dy = oy - cy;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      ox += (dx / dist) * 60;
      oy += (dy / dist) * 60;

      return {
        x: ox, y: oy,
        originX: ox, originY: oy,
        speed: 0.001 + Math.random() * 0.004, // progress per frame — faster
        progress: randomProgress ? Math.random() * 0.7 : 0,
        size: 0.8 + Math.random() * 3.5,
        hue: hueMin + Math.random() * (hueMax - hueMin),
        sat: 35 + Math.random() * 35,
        alpha: 0.15 + Math.random() * 0.45,
        offset: (Math.random() - 0.5) * 2,
        wobbleAmp: 1 + Math.random() * 4,
        wobbleFreq: 0.01 + Math.random() * 0.03,
        trail: [],
      };
    };

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
    particlesRef.current = Array.from({ length: COUNT }, () => createParticle(true));
    fogRef.current = Array.from({ length: FOG_COUNT }, createFog);

    const loop = () => {
      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      timeRef.current++;
      const t = timeRef.current;

      let pulse = 1;
      if (audioData && audioData.length > 0) {
        const avg = audioData.slice(0, 16).reduce((a, b) => a + b, 0) / 16;
        pulse = 1 + (avg / 255) * 1.0;
      }

      const cx = w / 2, cy = h / 2;

      // ── Fog ──
      for (const f of fogRef.current) {
        f.x += f.vx + Math.sin(t * 0.002 + f.phase) * 0.4;
        f.y += f.vy + Math.cos(t * 0.0015 + f.phase) * 0.2;
        if (f.x < -f.radius) f.x = w + f.radius;
        if (f.x > w + f.radius) f.x = -f.radius;
        if (f.y < -f.radius) f.y = h + f.radius;
        if (f.y > h + f.radius) f.y = -f.radius;

        const breathe = 1 + Math.sin(t * 0.004 + f.phase) * 0.2;
        const r = f.radius * breathe;
        const fogHue = (hueMin + hueMax) / 2;

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

      // ── Particles — straight lines from edges to center ──
      for (const p of particlesRef.current) {
        p.progress += p.speed * pulse;

        if (p.progress >= 1) {
          Object.assign(p, createParticle(false));
          continue;
        }

        // Interpolate from origin to center
        const prog = p.progress;
        // Ease-in: starts slow at edge, accelerates toward center
        const easedProg = prog * prog;

        const baseX = p.originX + (cx - p.originX) * easedProg;
        const baseY = p.originY + (cy - p.originY) * easedProg;

        // Lateral wobble perpendicular to travel direction
        const dx = cx - p.originX, dy = cy - p.originY;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const perpX = -dy / len, perpY = dx / len;
        const wobble = Math.sin(t * p.wobbleFreq + p.offset * 10) * p.wobbleAmp * (1 - prog);

        p.x = baseX + perpX * wobble;
        p.y = baseY + perpY * wobble;

        // Store trail
        p.trail.unshift({ x: p.x, y: p.y, a: p.alpha });
        if (p.trail.length > TRAIL_LEN) p.trail.pop();

        // Size + alpha scale with depth (progress = depth)
        const depthScale = easedProg;
        const s = (p.size * (0.3 + depthScale * 2.5)) * pulse;
        const a = p.alpha * (0.1 + depthScale * 0.9);
        if (a < 0.005) continue;

        // Color shifts toward white/brighter as particles approach center
        const hueShift = depthScale * 20;
        const drawHue = (p.hue + hueShift) % 360;
        const light = 45 + depthScale * 35;

        // ── Blur trail ──
        for (let ti = p.trail.length - 1; ti >= 1; ti--) {
          const tp = p.trail[ti];
          const trailFade = 1 - ti / p.trail.length;
          const trailAlpha = a * trailFade * 0.25;
          const trailSize = s * (0.3 + trailFade * 0.3);
          if (trailAlpha < 0.003) continue;

          ctx.globalAlpha = Math.min(trailAlpha, 0.25);
          const tg = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, trailSize + 4);
          tg.addColorStop(0, `hsla(${drawHue}, ${p.sat * 0.5}%, ${light}%, ${trailAlpha * 1.5})`);
          tg.addColorStop(1, `hsla(${drawHue}, ${p.sat * 0.3}%, ${light}%, 0)`);
          ctx.fillStyle = tg;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, trailSize + 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── Main particle ──
        const totalR = Math.max(s + 2, 0.5);
        ctx.globalAlpha = Math.min(a, 0.7);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, totalR);
        gradient.addColorStop(0, `hsla(${drawHue}, ${p.sat}%, ${light}%, ${Math.min(a * 2, 0.9)})`);
        gradient.addColorStop(0.35, `hsla(${drawHue}, ${p.sat}%, ${light}%, ${a * 0.5})`);
        gradient.addColorStop(1, `hsla(${drawHue}, ${p.sat}%, ${light}%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, totalR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [audioData, scheme]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-20" />;
}
