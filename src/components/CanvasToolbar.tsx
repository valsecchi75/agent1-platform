"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MiniMap, useReactFlow, useViewport } from "@xyflow/react";
import {
  MousePointer2,
  Hand,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Maximize,
  Map,
  Scissors,
  Link2Off,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────
interface CanvasToolbarProps {
  /** Minimap node color callback */
  nodeColor: (node: { type?: string }) => string;
}

type CursorMode = "select" | "hand";

// ─── Dropdown hook ───────────────────────────────────────────────
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return { open, setOpen, ref, toggle: () => setOpen((v) => !v) };
}

// ─── Main component ─────────────────────────────────────────────
export default function CanvasToolbar({ nodeColor }: CanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView, setViewport, getViewport } = useReactFlow();
  const viewport = useViewport();
  const zoomPercent = Math.round(viewport.zoom * 100);

  // State
  const [cursorMode, setCursorMode] = useState<CursorMode>("select");
  const [showMinimap, setShowMinimap] = useState(true);
  const [linksVisible, setLinksVisible] = useState(true);

  // Zoom input
  const [zoomInputValue, setZoomInputValue] = useState(String(zoomPercent));
  const zoomInputRef = useRef<HTMLInputElement>(null);

  // Toolbar bar width tracking (so minimap matches)
  const toolbarBarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(0);

  useEffect(() => {
    const el = toolbarBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setToolbarWidth(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dropdowns
  const cursorDD = useDropdown();
  const zoomDD = useDropdown();

  // ── Handlers ──────────────────────────────────────────────────
  const handleCursorChange = useCallback((mode: CursorMode) => {
    setCursorMode(mode);
    cursorDD.setOpen(false);
    window.dispatchEvent(new CustomEvent("canvas-cursor-mode", { detail: mode }));
  }, [cursorDD]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
    zoomDD.setOpen(false);
  }, [zoomIn, zoomDD]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
    zoomDD.setOpen(false);
  }, [zoomOut, zoomDD]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.1 });
    zoomDD.setOpen(false);
  }, [fitView, zoomDD]);

  const handleZoomInputSubmit = useCallback(() => {
    const val = parseInt(zoomInputValue, 10);
    if (!isNaN(val) && val >= 10 && val <= 400) {
      const vp = getViewport();
      setViewport({ ...vp, zoom: val / 100 }, { duration: 200 });
    }
    setZoomInputValue(String(zoomPercent));
  }, [zoomInputValue, zoomPercent, getViewport, setViewport]);

  const toggleLinks = useCallback(() => {
    const next = !linksVisible;
    setLinksVisible(next);
    window.dispatchEvent(new CustomEvent("canvas-toggle-links", { detail: next }));
  }, [linksVisible]);

  // Sync zoom percent into input when viewport changes
  useEffect(() => {
    if (document.activeElement !== zoomInputRef.current) {
      setZoomInputValue(String(zoomPercent));
    }
  }, [zoomPercent]);

  // ── Shared styles ─────────────────────────────────────────────
  const btnBase =
    "nodrag nopan flex items-center gap-1 px-2 py-1.5 text-xs rounded transition-colors " +
    "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--controls-hover)]";

  const dropdownPanel =
    "absolute bottom-full mb-1 right-0 min-w-[200px] " +
    "bg-[var(--controls-bg)] border border-[var(--controls-border)] rounded-lg shadow-xl " +
    "overflow-hidden z-50";

  const dropdownItem =
    "flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-secondary)] " +
    "hover:bg-[var(--controls-hover)] hover:text-[var(--text-primary)] transition-colors cursor-pointer";

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-1 nodrag nopan">

      {/* ── Minimap (togglable) ── */}
      {showMinimap && toolbarWidth > 0 && (
        <div
          className="relative h-[140px] bg-[var(--controls-bg)] border border-[var(--controls-border)] rounded-lg shadow-xl overflow-hidden mb-1"
          style={{ width: toolbarWidth }}
        >
          <button
            onClick={() => setShowMinimap(false)}
            className="absolute top-1 right-1 z-10 w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--controls-hover)] transition-colors"
            title="Hide minimap"
          >
            ×
          </button>
          <MiniMap
            className="!relative !w-full !h-full !m-0 !bg-transparent !border-0 !shadow-none !rounded-none"
            maskColor="rgba(0, 0, 0, 0.6)"
            pannable
            zoomable
            nodeColor={nodeColor}
          />
        </div>
      )}

      {/* ── Bottom toolbar bar ── */}
      <div ref={toolbarBarRef} className="flex items-center bg-[var(--controls-bg)] border border-[var(--controls-border)] rounded-lg shadow-xl">

        {/* ── Cursor mode ── */}
        <div ref={cursorDD.ref} className="relative">
          <button onClick={cursorDD.toggle} className={btnBase} title="Cursor mode">
            {cursorMode === "select"
              ? <MousePointer2 className="w-3.5 h-3.5" />
              : <Hand className="w-3.5 h-3.5" />
            }
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </button>
          {cursorDD.open && (
            <div className={dropdownPanel} style={{ minWidth: "150px" }}>
              <button
                onClick={() => handleCursorChange("select")}
                className={`${dropdownItem} ${cursorMode === "select" ? "text-[var(--text-primary)] bg-[var(--controls-hover)]" : ""}`}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Select</span>
                <kbd className="text-[var(--text-muted)] text-[10px]">V</kbd>
              </button>
              <button
                onClick={() => handleCursorChange("hand")}
                className={`${dropdownItem} ${cursorMode === "hand" ? "text-[var(--text-primary)] bg-[var(--controls-hover)]" : ""}`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Hand</span>
                <kbd className="text-[var(--text-muted)] text-[10px]">H</kbd>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-[var(--controls-border)]" />

        {/* ── Zoom: - button ── */}
        <button onClick={handleZoomOut} className={btnBase} title="Zoom Out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* ── Zoom: % dropdown ── */}
        <div ref={zoomDD.ref} className="relative">
          <button onClick={zoomDD.toggle} className={`${btnBase} min-w-[50px] justify-center`} title="Zoom">
            <span className="font-mono">{zoomPercent}%</span>
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </button>
          {zoomDD.open && (
            <div className={dropdownPanel} style={{ minWidth: "190px" }}>
              <button onClick={handleFitView} className={dropdownItem}>
                <Maximize className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Zoom To Fit</span>
                <kbd className="text-[var(--text-muted)] text-[10px]">.</kbd>
              </button>
              <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--controls-border)]">
                <input
                  ref={zoomInputRef}
                  type="number"
                  min={10}
                  max={400}
                  value={zoomInputValue}
                  onChange={(e) => setZoomInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleZoomInputSubmit();
                      zoomDD.setOpen(false);
                    }
                  }}
                  onBlur={handleZoomInputSubmit}
                  className="flex-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-mono text-center focus:outline-none focus:border-[var(--input-focus)]"
                />
                <span className="text-xs text-[var(--text-muted)]">%</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Zoom: + button ── */}
        <button onClick={handleZoomIn} className={btnBase} title="Zoom In">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-[var(--controls-border)]" />

        {/* ── Minimap toggle ── */}
        <button
          onClick={() => setShowMinimap((v) => !v)}
          className={`${btnBase} ${showMinimap ? "text-[var(--text-primary)]" : ""}`}
          title={showMinimap ? "Hide minimap" : "Show minimap"}
        >
          <Map className="w-3.5 h-3.5" />
        </button>

        {/* ── Hide/show links ── */}
        <button
          onClick={toggleLinks}
          className={`${btnBase} ${!linksVisible ? "text-[var(--accent)]" : ""}`}
          title={linksVisible ? "Hide links" : "Show links"}
        >
          {linksVisible
            ? <Scissors className="w-3.5 h-3.5" />
            : <Link2Off className="w-3.5 h-3.5" />
          }
        </button>
      </div>
    </div>
  );
}
