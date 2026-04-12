"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import { useCallback, useEffect, useRef } from "react";

/**
 * InteractiveGrid — Illuminates grid dots near the mouse cursor.
 *
 * Renders a transparent canvas on top of the ReactFlow pane that draws
 * brighter dots around the mouse position, creating a subtle spotlight
 * effect that helps locate the cursor on the canvas.
 *
 * Performance:
 * - Uses requestAnimationFrame for smooth 60fps rendering
 * - Only redraws when mouse actually moves (pointer coords change)
 * - Canvas is GPU-accelerated in all modern browsers
 * - Zero React re-renders (all state in refs)
 */

const GRID_GAP = 20;        // Must match <Background gap={20}>
const DOT_BASE_SIZE = 1;    // Must match <Background size={1}>
const GLOW_RADIUS = 120;    // px — radius of the illumination area
const MAX_DOT_SIZE = 2.2;   // px — max dot size at cursor center
const MAX_OPACITY = 0.55;   // max opacity at cursor center

export function InteractiveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const rafRef = useRef<number>(0);
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  const paneRef = useRef<HTMLElement | null>(null);

  const viewport = useViewport();

  // Keep viewport in ref to avoid re-renders
  useEffect(() => {
    viewportRef.current = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
  }, [viewport.x, viewport.y, viewport.zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const mouse = mouseRef.current;
    if (!mouse.active) return;

    const { x: vx, y: vy, zoom } = viewportRef.current;
    const gap = GRID_GAP * zoom;

    if (gap < 4) return; // Too zoomed out, skip

    // Convert mouse screen position to flow coordinates, then back to screen grid
    const flowX = (mouse.x - vx) / zoom;
    const flowY = (mouse.y - vy) / zoom;

    // Calculate visible grid range (only draw dots near the mouse)
    const radiusInFlow = GLOW_RADIUS / zoom;
    const startCol = Math.floor((flowX - radiusInFlow) / GRID_GAP);
    const endCol = Math.ceil((flowX + radiusInFlow) / GRID_GAP);
    const startRow = Math.floor((flowY - radiusInFlow) / GRID_GAP);
    const endRow = Math.ceil((flowY + radiusInFlow) / GRID_GAP);

    // Get accent color from CSS variable
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#c5a44e";

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        // Grid point in flow coordinates
        const gridFlowX = col * GRID_GAP;
        const gridFlowY = row * GRID_GAP;

        // Convert to screen coordinates
        const screenX = gridFlowX * zoom + vx;
        const screenY = gridFlowY * zoom + vy;

        // Distance from mouse (in screen pixels)
        const dx = screenX - mouse.x;
        const dy = screenY - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > GLOW_RADIUS) continue;

        // Ease out: stronger at center, fading at edges
        const t = 1 - dist / GLOW_RADIUS;
        const ease = t * t; // quadratic ease-out

        const dotSize = DOT_BASE_SIZE * zoom + (MAX_DOT_SIZE * zoom - DOT_BASE_SIZE * zoom) * ease;
        const opacity = MAX_OPACITY * ease;

        if (opacity < 0.02) continue;

        ctx.globalAlpha = opacity;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(dotSize / 2, 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }, []);

  const loop = useCallback(() => {
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  // Setup canvas and event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Find the ReactFlow pane
    const pane = canvas.closest(".react-flow") as HTMLElement | null;
    paneRef.current = pane;
    if (!pane) return;

    const resize = () => {
      const rect = pane.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = pane.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { ...mouseRef.current, active: false };
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(pane);

    pane.addEventListener("mousemove", handleMouseMove);
    pane.addEventListener("mouseleave", handleMouseLeave);

    // Start render loop
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      pane.removeEventListener("mousemove", handleMouseMove);
      pane.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [loop]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
