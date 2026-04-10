"use client";

import { Node, NodeResizer, OnResize, useReactFlow } from "@xyflow/react";
import { ReactNode, useCallback, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import { isPanningRef, isDraggingNodeRef } from "@/components/WorkflowCanvas";
import { useWorkflowStore } from "@/store/workflowStore";
import { getMediaDimensions, calculateAspectFitSize } from "@/utils/nodeDimensions";

const DEFAULT_NODE_DIMENSION = 300;

interface BaseNodeProps {
  id: string;
  children: ReactNode;
  selected?: boolean;
  isExecuting?: boolean;
  hasError?: boolean;
  className?: string;
  contentClassName?: string;
  minWidth?: number;
  minHeight?: number;
  /** When true, node has no background/border — content fills the entire node area */
  fullBleed?: boolean;
  /** Media URL (image/video) to use for aspect-fit resize on resize-handle double-click */
  aspectFitMedia?: string | null;
  /** When true, bottom corners lose rounding so the selection ring connects to the settings panel below */
  settingsExpanded?: boolean;
  /** Settings panel rendered outside the bordered area so it shares the node's full width */
  settingsPanel?: ReactNode;
  /** When false, the node cannot be resized by the user (default: true) */
  resizable?: boolean;
}

/**
 * Read a node's effective width or height, respecting React Flow's internal
 * priority: node.width > node.style.width > node.measured.width.
 */
function getNodeDimension(node: Node, axis: "width" | "height"): number {
  return (
    (node[axis] as number) ??
    (node.style?.[axis] as number) ??
    (node.measured?.[axis] as number) ??
    DEFAULT_NODE_DIMENSION
  );
}

/**
 * Apply dimensions to a React Flow node, writing to both `node.width/height`
 * (where NodeResizer writes) and `node.style` (the original source) so neither
 * silently overrides the other.
 */
function applyNodeDimensions(node: Node, width: number, height: number): Node {
  return {
    ...node,
    width,
    height,
    style: { ...node.style, width, height },
  };
}

export function BaseNode({
  id,
  children,
  selected = false,
  isExecuting = false,
  hasError = false,
  className = "",
  contentClassName,
  minWidth = 180,
  minHeight = 100,
  fullBleed = false,
  aspectFitMedia,
  settingsExpanded = false,
  settingsPanel,
  resizable = true,
}: BaseNodeProps) {
  const currentNodeIds = useWorkflowStore((state) => state.currentNodeIds);
  const setHoveredNodeId = useWorkflowStore((state) => state.setHoveredNodeId);
  const nodeDesignMode = useWorkflowStore((state) => state.nodeDesignMode);
  const isCurrentlyExecuting = currentNodeIds.includes(id);
  const { getNodes, setNodes, getNode } = useReactFlow();
  const isV2 = nodeDesignMode === "v2";

  // Read per-node color and minimize state from node data
  const nodeData = getNode(id)?.data as Record<string, unknown> | undefined;
  const nodeColor = (nodeData?.nodeColor as string) || undefined;
  const nodeColorMode = (nodeData?.nodeColorMode as "accent" | "tint") || "tint";
  const isMinimized = !!(nodeData?.isMinimized);
  const isBypassed = !!(nodeData?.bypassed);

  // Propagate --node-custom-color and minimized class to the ReactFlow wrapper element
  // so the glow pseudo-elements (::before/::after on .react-flow__node) can use it
  useEffect(() => {
    const nodeEl = document.querySelector(`[data-id="${id}"].react-flow__node`) as HTMLElement | null;
    if (!nodeEl) return;
    if (nodeColor) {
      nodeEl.style.setProperty("--node-custom-color", nodeColor);
    } else {
      nodeEl.style.removeProperty("--node-custom-color");
    }
    nodeEl.classList.toggle("node-minimized", isMinimized);
  }, [id, nodeColor, isMinimized]);

  // Build per-node color CSS class and inline style
  // Color always applies (both Classic and v2) — tint fills the interior, accent is border-only
  const colorStyle = useMemo(() => {
    if (!nodeColor) return { className: "", style: {} as React.CSSProperties };
    const colorClass = nodeColorMode === "accent" ? "node-color-accent" : "node-color-tint";
    return {
      className: colorClass,
      style: { "--node-custom-color": nodeColor } as React.CSSProperties,
    };
  }, [nodeColor, nodeColorMode]);

  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const trackedSettingsHeightRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust node height when settings expand or collapse
  useLayoutEffect(() => {
    // Cancel any pending animation timeout from a previous toggle (handles rapid toggling)
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }

    const contentEl = contentRef.current;
    const ANIMATION_MS = 160;

    if (!settingsExpanded && trackedSettingsHeightRef.current > 0) {
      // --- COLLAPSE ---
      const heightToRemove = trackedSettingsHeightRef.current;
      trackedSettingsHeightRef.current = 0;
      isAnimatingRef.current = true;

      // Lock content height for the full animation duration
      if (contentEl) {
        contentEl.style.height = contentEl.offsetHeight + "px";
      }

      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;
          const currentHeight = getNodeDimension(node, "height");
          const newHeight = Math.max(minHeight, currentHeight - heightToRemove);
          return applyNodeDimensions(node, getNodeDimension(node, "width"), newHeight);
        })
      );

      animationTimeoutRef.current = setTimeout(() => {
        isAnimatingRef.current = false;
        if (contentEl) contentEl.style.height = "";
      }, ANIMATION_MS);
    } else if (settingsExpanded && settingsPanel) {
      // --- EXPAND ---
      // Lock the content wrapper rigid so flex can't redistribute space as the
      // settings panel grows. Without this, flex-1 + min-h-0 lets the wrapper
      // shrink between CSS transition frames and the ResizeObserver setNodes catch-up.
      isAnimatingRef.current = true;

      if (contentEl) {
        const wrapperEl = contentEl.parentElement as HTMLElement | null;
        if (wrapperEl) {
          wrapperEl.style.flex = "none";
          wrapperEl.style.height = wrapperEl.offsetHeight + "px";
        }
      }

      animationTimeoutRef.current = setTimeout(() => {
        isAnimatingRef.current = false;

        // Apply the final panel height in one shot, then unlock the wrapper
        const finalHeight = trackedSettingsHeightRef.current;
        if (finalHeight > 0) {
          setNodes((nodes) =>
            nodes.map((node) => {
              if (node.id !== id) return node;
              const currentHeight = getNodeDimension(node, "height");
              return applyNodeDimensions(node, getNodeDimension(node, "width"), currentHeight + finalHeight);
            })
          );
        }

        if (contentEl) {
          const wrapperEl = contentEl.parentElement as HTMLElement | null;
          if (wrapperEl) {
            wrapperEl.style.flex = "";
            wrapperEl.style.height = "";
          }
        }
      }, ANIMATION_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsExpanded]);

  // ResizeObserver to track dynamic settings panel height changes (e.g., model param count changes)
  useLayoutEffect(() => {
    if (!settingsExpanded || !settingsPanel) return;
    const panelEl = settingsPanelRef.current;
    if (!panelEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newPanelHeight = entry.contentRect.height;
        if (newPanelHeight === 0) continue;
        const delta = newPanelHeight - trackedSettingsHeightRef.current;
        if (Math.abs(delta) < 2) continue; // Ignore sub-pixel changes

        trackedSettingsHeightRef.current = newPanelHeight;

        // During animation, just track the height — skip setNodes to avoid
        // multiple re-renders. The expand timeout will apply one final update.
        if (isAnimatingRef.current) continue;

        // Lock content height to prevent image flicker during resize
        const contentEl = contentRef.current;
        if (contentEl) {
          contentEl.style.height = contentEl.offsetHeight + "px";
        }

        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id !== id) return node;
            const currentHeight = getNodeDimension(node, "height");
            const newHeight = Math.max(minHeight, currentHeight + delta);
            return applyNodeDimensions(node, getNodeDimension(node, "width"), newHeight);
          })
        );

        // Release locked height after layout settles
        requestAnimationFrame(() => {
          if (contentEl) {
            contentEl.style.height = "";
          }
        });
      }
    });

    observer.observe(panelEl);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsExpanded, settingsPanel]);

  // Cleanup animation timeout on unmount
  useLayoutEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const handleResize: OnResize = useCallback(
    (_event, params) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.selected && node.id !== id) {
            return applyNodeDimensions(node, params.width, params.height);
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );

  const handleResizeHandleDblClick = useCallback(
    async (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".react-flow__resize-control")) return;
      if (!aspectFitMedia) return;

      e.stopPropagation();
      const dims = await getMediaDimensions(aspectFitMedia);
      if (!dims) return;

      const thisNode = getNodes().find((n) => n.id === id);
      if (!thisNode) return;

      const nodeHeight = getNodeDimension(thisNode, "height");
      const contentHeight = nodeHeight - trackedSettingsHeightRef.current;

      const newSize = calculateAspectFitSize(
        dims.width / dims.height,
        getNodeDimension(thisNode, "width"),
        contentHeight,
        fullBleed
      );

      const finalHeight = newSize.height + trackedSettingsHeightRef.current;

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id || (n.selected && n.id !== id)) {
            return applyNodeDimensions(n, newSize.width, finalHeight);
          }
          return n;
        })
      );
    },
    [aspectFitMedia, id, fullBleed, getNodes, setNodes]
  );

  const hasExpandedSettings = settingsExpanded && settingsPanel;

  // V2 rounding values
  const v2Round = isV2 ? "rounded-xl" : "rounded-lg";
  const v2RoundTop = isV2 ? "rounded-t-xl" : "rounded-t-lg";

  // ── MINIMIZED: render compact pill + invisible children (to keep Handles alive for connections) ──
  if (isMinimized) {
    const label = (nodeData?.customTitle as string) || (nodeData?.label as string) || "";
    const pillBg = nodeColor
      ? { background: `color-mix(in srgb, ${nodeColor} 30%, var(--tw-neutral-900, #1a1a2e))`, borderColor: `color-mix(in srgb, ${nodeColor} 50%, transparent)` }
      : {};
    return (
      <div
        className={`w-full h-full relative rounded-full border shadow-lg ${
          isCurrentlyExecuting || isExecuting ? "border-[var(--accent)]" : "border-neutral-700/60"
        } ${colorStyle.className} ${className}`}
        style={{ ...colorStyle.style, ...pillBg, background: pillBg.background || "var(--node-bg, #1a1a1a)" }}
        onMouseEnter={(e) => {
          if (e.buttons !== 0 || isPanningRef.current || isDraggingNodeRef.current) return;
          setHoveredNodeId(id);
        }}
        onMouseLeave={(e) => {
          if (e.buttons !== 0 || isPanningRef.current || isDraggingNodeRef.current) return;
          setHoveredNodeId(null);
        }}
      >
        {/* Pill visual content */}
        <div className="flex items-center w-full h-full overflow-hidden">
          {/* Colored dot indicator */}
          {nodeColor && (
            <div className="w-2.5 h-2.5 rounded-full ml-3 shrink-0" style={{ background: nodeColor }} />
          )}
          <span className={`text-xs font-semibold uppercase tracking-wide truncate ${nodeColor ? "ml-2" : "ml-3"} mr-3 ${
            nodeColor ? "text-neutral-200" : "text-neutral-400"
          }`}>
            {label}
          </span>
        </div>
        {/* Children container — keeps Handle components mounted so edges (connections) remain.
            Non-handle content is hidden; handles stay visible and connectable. */}
        <div className="absolute inset-0 overflow-visible node-minimized-children">
          {children}
        </div>
      </div>
    );
  }

  // ── NORMAL: full node render ──
  return (
    <div
      className={hasExpandedSettings
        ? `relative flex flex-col w-full h-full overflow-visible bg-[var(--node-bg,#1a1a1a)] ${v2Round}`
        : "contents"}
      onDoubleClick={handleResizeHandleDblClick}
    >
      <NodeResizer
        isVisible={resizable && selected}
        minWidth={minWidth}
        minHeight={minHeight}
        lineClassName="!border-transparent"
        handleClassName="!w-5 !h-5 !bg-transparent !border-none"
        onResize={handleResize}
      />
      <div
        className={`
          ${hasExpandedSettings ? "flex-1 min-h-0 w-full" : "h-full w-full"} flex flex-col overflow-visible relative
          ${isV2 ? "node-v2-shell" : ""}
          ${fullBleed
            ? `${settingsExpanded ? `${v2RoundTop} border-b-0` : v2Round} bg-[var(--node-bg,#1a1a1a)] border border-neutral-700/40`
            : `bg-[var(--node-bg,#1a1a1a)] ${settingsExpanded ? `${v2RoundTop} border-b-0` : v2Round} shadow-lg border`}
          ${fullBleed ? "" : (isCurrentlyExecuting || isExecuting ? "border-[var(--accent)] ring-1 ring-[var(--accent)]/20" : isBypassed ? "border-neutral-600/50" : "border-neutral-700/60")}
          ${fullBleed ? "" : (hasError ? "border-red-500" : "")}
          ${isBypassed ? "node-bypassed-border" : ""}
          ${colorStyle.className}
          ${className}
        `}
        style={colorStyle.style}
        onMouseEnter={(e) => {
          if (e.buttons !== 0 || isPanningRef.current || isDraggingNodeRef.current) return;
          setHoveredNodeId(id);
        }}
        onMouseLeave={(e) => {
          if (e.buttons !== 0 || isPanningRef.current || isDraggingNodeRef.current) return;
          setHoveredNodeId(null);
        }}
      >
        <div
          ref={contentRef}
          style={{ contain: "layout style" }}
          className={contentClassName ?? (fullBleed ? "flex-1 min-h-0 relative" : "px-3 pb-4 flex-1 min-h-0 overflow-visible flex flex-col")}
        >
          {children}
          {/* Bypass overlay — rendered inside content to inherit border-radius */}
          {isBypassed && (
            <>
              <div className="node-bypassed-overlay" />
              <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 bg-neutral-900/90 px-2 py-[2px] rounded select-none">
                  bypass
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      {settingsPanel && (
        <div ref={settingsPanelRef}>
          {settingsPanel}
        </div>
      )}
    </div>
  );
}
