"use client";

import { useReactFlow } from "@xyflow/react";
import {
  Lock,
  MessageSquare,
  MessageSquareText,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Play,
  Trash2,
  Tags,
  Palette,
  X as XIcon,
} from "lucide-react";
import { ReactNode, useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { ProviderBadge } from "./ProviderBadge";
import { useHandleLabels } from "@/hooks/useHandleLabels";
import { defaultNodeDimensions } from "@/store/utils/nodeDefaults";
import { useWorkflowStore } from "@/store/workflowStore";
import { NodeType, ProviderType } from "@/types";

export interface CommentNavigationProps {
  currentIndex: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
}

const RUNNABLE_TYPES = new Set(['nanoBanana', 'generateVideo', 'generate3d', 'generateAudio', 'llmGenerate']);
const EXPANDABLE_TYPES = new Set(['prompt', 'promptConstructor', 'splitGrid', 'annotation']);

interface FloatingNodeHeaderProps {
  id: string;
  type: NodeType;
  isInLockedGroup?: boolean;
  isExecuting?: boolean;
  focusedCommentNodeId?: string | null;
  position: { x: number; y: number };
  width: number;
  selected: boolean;
  onExpandNode?: (nodeId: string, nodeType: string) => void;
  onRunNode?: (nodeId: string) => void;
  headerAction?: ReactNode;
  headerButtons?: ReactNode;
  provider?: ProviderType;
  title: string;
  customTitle?: string;
  comment?: string;
  onCustomTitleChange?: (nodeId: string, title: string) => void;
  onCommentChange?: (nodeId: string, comment: string) => void;
  commentNavigation?: CommentNavigationProps;
}

/* ─── Per-node color presets ─── */
const NODE_COLOR_PRESETS = [
  { id: "none",   hex: null,      label: "Default (skin)" },
  { id: "blue",   hex: "#3b82f6", label: "Blue" },
  { id: "green",  hex: "#10b981", label: "Green" },
  { id: "purple", hex: "#8b5cf6", label: "Purple" },
  { id: "orange", hex: "#f59e0b", label: "Orange" },
  { id: "red",    hex: "#ef4444", label: "Red" },
  { id: "pink",   hex: "#ec4899", label: "Pink" },
  { id: "cyan",   hex: "#06b6d4", label: "Cyan" },
  { id: "amber",  hex: "#d97706", label: "Amber" },
] as const;

/* ─── Icon button style helper ─── */
/** Returns consistent Tailwind classes for header icon buttons.
 *  When `onColor` is true, buttons use high-contrast white styles. */
function iconBtnClass(active: boolean, onColor: boolean): string {
  if (onColor) {
    return active
      ? "text-white hover:text-white/80"
      : "text-white/70 hover:text-white border border-white/25 hover:border-white/40";
  }
  return active
    ? "text-neutral-400 hover:text-neutral-200"
    : "text-neutral-500 hover:text-neutral-200 border border-neutral-600";
}

/* ─── NodeColorPicker (optimized with updateNodeData) ─── */
function NodeColorPicker({ nodeId, onColor }: { nodeId: string; onColor: boolean }) {
  const { getNode, updateNodeData } = useReactFlow();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const nodeData = getNode(nodeId)?.data as Record<string, unknown> | undefined;
  const currentColor = (nodeData?.nodeColor as string) || null;
  const currentMode = (nodeData?.nodeColorMode as "accent" | "tint") || "tint";

  // O(1) single-node update instead of O(n) setNodes map
  const setNodeColor = useCallback((color: string | null, mode?: "accent" | "tint") => {
    if (color) {
      updateNodeData(nodeId, { nodeColor: color, nodeColorMode: mode || currentMode });
    } else {
      updateNodeData(nodeId, { nodeColor: undefined, nodeColorMode: undefined });
    }
  }, [nodeId, updateNodeData, currentMode]);

  const toggleMode = useCallback(() => {
    if (!currentColor) return;
    const newMode = currentMode === "accent" ? "tint" : "accent";
    setNodeColor(currentColor, newMode);
  }, [currentColor, currentMode, setNodeColor]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={pickerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`nodrag nopan p-0.5 rounded transition-colors ${
          currentColor
            ? "hover:opacity-80"
            : iconBtnClass(false, onColor)
        }`}
        title="Node color"
      >
        {currentColor ? (
          <div className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm" style={{ background: currentColor }} />
        ) : (
          <Palette className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <div className="absolute z-[60] right-0 top-full mt-1 p-2 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl min-w-max">
          {/* Color dots */}
          <div className="flex items-center gap-1.5">
            {NODE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setNodeColor(preset.hex);
                  if (!preset.hex) setOpen(false);
                }}
                className={`nodrag nopan w-5 h-5 rounded-full transition-all duration-100 ${
                  (preset.hex === currentColor || (!preset.hex && !currentColor))
                    ? "ring-2 ring-white/60 ring-offset-1 ring-offset-neutral-800 scale-110"
                    : "hover:scale-110"
                }`}
                style={preset.hex ? { background: preset.hex } : undefined}
                title={preset.label}
              >
                {!preset.hex && (
                  <XIcon className="w-3 h-3 mx-auto text-neutral-400" />
                )}
              </button>
            ))}
          </div>

          {/* Mode toggle (only when color is set) */}
          {currentColor && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-700">
              <button
                onClick={toggleMode}
                className="nodrag nopan flex-1 text-[10px] px-2 py-1 rounded transition-colors bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
              >
                {currentMode === "accent" ? "Border only" : "Background tint"}
              </button>
              <span className="text-[9px] text-neutral-500">
                click to toggle
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Handle Labels Toggle ─── */
function HandleLabelsToggle({ onColor }: { onColor: boolean }) {
  const { handleLabelsVisible, setHandleLabels } = useHandleLabels();
  return (
    <button
      onClick={() => setHandleLabels(!handleLabelsVisible)}
      className={`nodrag nopan p-0.5 rounded transition-colors ${iconBtnClass(handleLabelsVisible, onColor)}`}
      title={handleLabelsVisible ? "Hide handle labels" : "Show handle labels"}
    >
      <Tags className="w-3.5 h-3.5" />
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   FloatingNodeHeader — main exported component
   ═══════════════════════════════════════════════════ */
export const FloatingNodeHeader = memo(function FloatingNodeHeader({
  id,
  type,
  isInLockedGroup = false,
  isExecuting = false,
  focusedCommentNodeId,
  position,
  width,
  selected,
  onExpandNode,
  onRunNode,
  headerAction,
  headerButtons,
  provider,
  title,
  customTitle,
  comment,
  onCustomTitleChange,
  onCommentChange,
  commentNavigation,
}: FloatingNodeHeaderProps) {
  const canRun = RUNNABLE_TYPES.has(type);
  const canExpand = EXPANDABLE_TYPES.has(type);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const nodeDesignMode = useWorkflowStore((state) => state.nodeDesignMode);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const isBodyHovered = useWorkflowStore((state) => state.hoveredNodeId === id);
  const isHovered = isHeaderHovered || isBodyHovered;
  const isV2 = nodeDesignMode === "v2";

  // Single useReactFlow() call for all needs
  const { getNode, updateNodeData, setNodes, getNodes, getViewport } = useReactFlow();
  const nodeData = getNode(id)?.data as Record<string, unknown> | undefined;
  const headerNodeColor = (nodeData?.nodeColor as string) || null;
  const isMinimized = !!(nodeData?.isMinimized);

  // Determine header background: custom color > v2 accent > none
  const hasColoredBg = !!(headerNodeColor || isV2);

  // Compute header inline style
  const headerStyle = (() => {
    if (headerNodeColor) {
      // Custom node color — strong tint background
      return {
        background: `color-mix(in srgb, ${headerNodeColor} 32%, var(--tw-neutral-900, #1a1a2e))`,
        borderBottom: `1px solid color-mix(in srgb, ${headerNodeColor} 45%, transparent)`,
      } as React.CSSProperties;
    }
    if (isV2) {
      // V2 default — subtle accent background
      return {
        background: `color-mix(in srgb, var(--accent) 18%, var(--tw-neutral-900, #1a1a2e))`,
        borderBottom: `1px solid color-mix(in srgb, var(--accent) 25%, transparent)`,
      } as React.CSSProperties;
    }
    return undefined;
  })();

  // Minimize toggle — saves/restores dimensions for pill shape
  const PILL_HEIGHT = 36;
  const PILL_MIN_WIDTH = 160;

  const toggleMinimize = useCallback(() => {
    const node = getNode(id);
    if (!node) return;

    if (!isMinimized) {
      // ── MINIMIZE: save current size, shrink to pill ──
      const curW = (node.width as number) || (node.style?.width as number) || (node.measured?.width) || 300;
      const curH = (node.height as number) || (node.style?.height as number) || (node.measured?.height) || 280;
      const pillW = Math.max(PILL_MIN_WIDTH, Math.min(curW, 320));

      updateNodeData(id, { isMinimized: true, preMinWidth: curW, preMinHeight: curH });
      // Resize the node to pill dimensions
      setNodes((nodes) => nodes.map((n) => {
        if (n.id !== id) return n;
        return { ...n, width: pillW, height: PILL_HEIGHT, style: { ...n.style, width: pillW, height: PILL_HEIGHT } };
      }));
    } else {
      // ── RESTORE: bring back original size ──
      const nd = node.data as Record<string, unknown>;
      const restoreW = (nd.preMinWidth as number) || 300;
      const restoreH = (nd.preMinHeight as number) || 280;

      updateNodeData(id, { isMinimized: false, preMinWidth: undefined, preMinHeight: undefined });
      setNodes((nodes) => nodes.map((n) => {
        if (n.id !== id) return n;
        return { ...n, width: restoreW, height: restoreH, style: { ...n.style, width: restoreW, height: restoreH } };
      }));
    }
  }, [id, isMinimized, getNode, updateNodeData, setNodes]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(customTitle || "");
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editCommentValue, setEditCommentValue] = useState(comment || "");
  const [showCommentTooltip, setShowCommentTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const commentPopoverRef = useRef<HTMLDivElement>(null);
  const commentButtonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isCommentFocused = focusedCommentNodeId === id;

  useEffect(() => {
    if (!isEditingTitle) {
      setEditTitleValue(customTitle || "");
    }
  }, [customTitle, isEditingTitle]);

  useEffect(() => {
    if (!isEditingComment) {
      setEditCommentValue(comment || "");
    }
  }, [comment, isEditingComment]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!(showCommentTooltip || isCommentFocused) || !commentButtonRef.current) {
      setTooltipPosition(null);
      return;
    }

    const updatePosition = () => {
      if (commentButtonRef.current) {
        const rect = commentButtonRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
      }
    };

    updatePosition();

    let animationId: number;
    const trackPosition = () => {
      updatePosition();
      animationId = requestAnimationFrame(trackPosition);
    };
    animationId = requestAnimationFrame(trackPosition);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [showCommentTooltip, isCommentFocused]);

  const handleTitleSubmit = useCallback(() => {
    const trimmed = editTitleValue.trim();
    if (trimmed !== (customTitle || "")) {
      onCustomTitleChange?.(id, trimmed);
    }
    setIsEditingTitle(false);
  }, [editTitleValue, customTitle, onCustomTitleChange, id]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleTitleSubmit();
      } else if (e.key === "Escape") {
        setEditTitleValue(customTitle || "");
        setIsEditingTitle(false);
      }
    },
    [handleTitleSubmit, customTitle]
  );

  const handleCommentSubmit = useCallback(() => {
    const trimmed = editCommentValue.trim();
    if (trimmed !== (comment || "")) {
      onCommentChange?.(id, trimmed);
    }
    setIsEditingComment(false);
  }, [editCommentValue, comment, onCommentChange, id]);

  const handleCommentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditCommentValue(comment || "");
        setIsEditingComment(false);
      }
    },
    [comment]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commentPopoverRef.current && !commentPopoverRef.current.contains(e.target as Node)) {
        handleCommentSubmit();
      }
    };

    if (isEditingComment) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditingComment, handleCommentSubmit]);

  const showControls = isHovered || selected;

  const isDraggingRef = useRef(false);

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.nodrag, button, input, textarea, a')) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const allNodes = getNodes();
    const targetNode = allNodes.find(n => n.id === id);
    if (!targetNode) return;

    if (!targetNode.selected) {
      setNodes(nodes => nodes.map(n => ({
        ...n,
        selected: n.id === id,
      })));
    }

    const movingIds = targetNode.selected
      ? new Set(allNodes.filter(n => n.selected).map(n => n.id))
      : new Set([id]);
    const startPositions = new Map(
      allNodes.filter(n => movingIds.has(n.id)).map(n => [n.id, { x: n.position.x, y: n.position.y }])
    );

    isDraggingRef.current = false;

    const handlePointerMove = (e: PointerEvent) => {
      const screenDx = e.clientX - startX;
      const screenDy = e.clientY - startY;

      if (!isDraggingRef.current && (Math.abs(screenDx) > 5 || Math.abs(screenDy) > 5)) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current) {
        const { zoom } = getViewport();
        const dx = screenDx / zoom;
        const dy = screenDy / zoom;
        setNodes(nodes => nodes.map(n => {
          const startPos = startPositions.get(n.id);
          if (!startPos) return n;
          return {
            ...n,
            position: { x: startPos.x + dx, y: startPos.y + dy },
          };
        }));
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const wasDragging = isDraggingRef.current;

      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      isDraggingRef.current = false;

      if (wasDragging) {
        const store = useWorkflowStore.getState();
        const { zoom } = getViewport();
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;

        for (const [nodeId, startPos] of startPositions) {
          const finalX = startPos.x + dx;
          const finalY = startPos.y + dy;

          const storeNode = store.nodes.find(n => n.id === nodeId);
          if (!storeNode) continue;

          const nodeType = storeNode.type as NodeType;
          const defaults = defaultNodeDimensions[nodeType] || { width: 300, height: 280 };
          const nodeWidth = storeNode.measured?.width || (storeNode.style?.width as number) || defaults.width;
          const nodeHeight = storeNode.measured?.height || (storeNode.style?.height as number) || defaults.height;

          const nodeCenterX = finalX + nodeWidth / 2;
          const nodeCenterY = finalY + nodeHeight / 2;

          let targetGroupId: string | undefined;

          for (const group of Object.values(store.groups)) {
            const inBoundsX = nodeCenterX >= group.position.x && nodeCenterX <= group.position.x + group.size.width;
            const inBoundsY = nodeCenterY >= group.position.y && nodeCenterY <= group.position.y + group.size.height;

            if (inBoundsX && inBoundsY) {
              targetGroupId = group.id;
              break;
            }
          }

          const currentGroupId = storeNode.groupId;
          if (targetGroupId !== currentGroupId) {
            store.setNodeGroupId(nodeId, targetGroupId);
          }
        }
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [id, getNodes, getViewport, setNodes]);

  /* ─── Icon button class shorthand (contrast-aware) ─── */
  const ib = (active: boolean) => iconBtnClass(active, hasColoredBg);

  return (
    <div
      className="absolute pointer-events-none transition-opacity duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 28}px`,
        width: `${width}px`,
        zIndex: selected ? 10000 : 9000,
      }}
    >
      <div
        className={`px-1 py-1.5 flex items-center justify-between w-full pointer-events-auto cursor-grab rounded-t-lg transition-colors duration-150`}
        style={headerStyle}
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
        onPointerDown={handleHeaderPointerDown}
      >
        {/* Title Section — hidden when minimized (pill shows the title) */}
        {!isMinimized && (
          <div className="flex-1 min-w-0 max-w-[60%] flex items-center gap-1.5 pl-2">
            {provider && <ProviderBadge provider={provider} />}
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={editTitleValue}
                onChange={(e) => setEditTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={handleTitleKeyDown}
                placeholder="Custom title..."
                className={`nodrag nopan w-full bg-transparent border-none outline-none text-xs font-semibold tracking-wide uppercase ${
                  hasColoredBg ? "text-white placeholder:text-white/40" : "text-neutral-300 placeholder:text-neutral-500"
                }`}
              />
            ) : (
              <span
                className={`nodrag text-xs font-semibold uppercase tracking-wide cursor-text truncate ${
                  hasColoredBg ? "text-white/90" : "text-neutral-400"
                }`}
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                {customTitle ? `${customTitle} - ${title}` : title}
              </span>
            )}
          </div>
        )}

        {/* Controls - right-aligned, fade in on hover/selected. Always visible when minimized. */}
        <div className={`shrink-0 flex items-center gap-1 pr-1 transition-opacity duration-200 ${(showControls || isMinimized) ? 'opacity-100' : 'opacity-0'}`}>
          {/* Header Action (e.g. Browse button) */}
          {headerAction}

          {/* Lock Badge for nodes in locked groups */}
          {isInLockedGroup && (
            <div className="shrink-0 flex items-center" title="This node is in a locked group and will be skipped during execution">
              <Lock className="w-3.5 h-3.5 text-yellow-500" />
            </div>
          )}

          {/* Custom Header Buttons */}
          {headerButtons}

          {/* Toggle Handle Labels */}
          <HandleLabelsToggle onColor={hasColoredBg} />

          {/* Per-node Color Picker */}
          <NodeColorPicker nodeId={id} onColor={hasColoredBg} />

          {/* Minimize / Restore Button */}
          <button
            onClick={toggleMinimize}
            className={`nodrag nopan p-0.5 rounded transition-colors ${
              isMinimized
                ? (hasColoredBg ? "text-white hover:text-white/80" : "text-[var(--accent)] hover:text-[var(--accent-hover)]")
                : ib(false)
            }`}
            title={isMinimized ? "Restore node" : "Minimize node"}
          >
            {isMinimized ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Comment Icon */}
          <div className="relative shrink-0 flex items-center gap-1" ref={commentPopoverRef}>
            <button
              ref={commentButtonRef}
              onClick={() => setIsEditingComment(!isEditingComment)}
              onMouseEnter={() => comment && !isCommentFocused && setShowCommentTooltip(true)}
              onMouseLeave={() => setShowCommentTooltip(false)}
              className={`nodrag nopan p-0.5 rounded transition-colors ${
                comment
                  ? (hasColoredBg ? "text-white hover:text-white/80" : "text-[var(--accent)] hover:text-[var(--accent-hover)]")
                  : ib(false)
              }`}
              title={comment ? "Edit comment" : "Add comment"}
            >
              {comment ? (
                <MessageSquareText className="w-3.5 h-3.5 fill-current" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Comment Tooltip with Navigation */}
            {(showCommentTooltip || isCommentFocused) && comment && !isEditingComment && tooltipPosition && createPortal(
              <div
                ref={tooltipRef}
                className="fixed z-[9999] p-3 text-sm text-neutral-200 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl"
                style={{
                  top: tooltipPosition.top,
                  left: tooltipPosition.left,
                  transform: "translateY(-100%) translateX(-50%)",
                }}
              >
                {isCommentFocused && commentNavigation && (
                  <div className="flex items-center justify-center gap-3 mb-2 pb-2 border-b border-neutral-700">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        commentNavigation.onPrevious();
                      }}
                      className="nodrag nopan w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 rounded transition-colors"
                      title="Previous comment"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-neutral-400 min-w-[32px] text-center">
                      {commentNavigation.currentIndex}/{commentNavigation.totalCount}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        commentNavigation.onNext();
                      }}
                      className="nodrag nopan w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 rounded transition-colors"
                      title="Next comment"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="max-w-[240px] whitespace-pre-wrap break-words">
                  {comment}
                </div>
              </div>,
              document.body
            )}

            {/* Comment Edit Popover */}
            {isEditingComment && (
              <div className="absolute z-[60] right-0 top-full mt-1 w-64 p-2 bg-neutral-800 border border-neutral-600 rounded shadow-lg">
                <textarea
                  value={editCommentValue}
                  onChange={(e) => setEditCommentValue(e.target.value)}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Add a comment..."
                  autoFocus
                  className="nodrag nopan nowheel w-full h-20 p-2 text-xs text-neutral-100 bg-neutral-900/50 border border-neutral-700 rounded resize-none focus:outline-none focus:ring-1 focus:ring-neutral-600"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setEditCommentValue(comment || "");
                      setIsEditingComment(false);
                    }}
                    className="px-2 py-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommentSubmit}
                    className="px-2 py-1 text-xs text-[var(--btn-primary-text)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Expand Button */}
          {canExpand && onExpandNode && (
            <div className="relative shrink-0 group">
              <button
                onClick={() => onExpandNode(id, type)}
                className={`nodrag nopan p-0.5 rounded transition-all duration-200 ease-in-out flex items-center overflow-hidden group-hover:pr-2 ${
                  hasColoredBg
                    ? "text-white/70 group-hover:text-white border border-white/25"
                    : "text-neutral-500 group-hover:text-neutral-200 border border-neutral-600"
                }`}
                title="Expand editor"
              >
                <Maximize2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={`max-w-0 opacity-0 whitespace-nowrap text-[10px] transition-all duration-200 ease-in-out overflow-hidden group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1`}>
                  Expand
                </span>
              </button>
            </div>
          )}

          {/* Run Button */}
          {canRun && onRunNode && (
            <div className="relative shrink-0 group">
              <button
                onClick={() => onRunNode(id)}
                disabled={isExecuting}
                className="nodrag nopan p-0.5 rounded transition-all duration-200 ease-in-out text-[var(--btn-primary-text)] bg-[var(--btn-primary-bg)] hover:bg-[var(--accent-hover)] border border-[var(--accent-hover)] flex items-center overflow-hidden group-hover:pr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Run this node"
              >
                <Play className="w-3.5 h-3.5 flex-shrink-0 fill-current" />
                <span className="max-w-0 opacity-0 whitespace-nowrap text-[10px] transition-all duration-200 ease-in-out overflow-hidden group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1">
                  Run node
                </span>
              </button>
            </div>
          )}

          {/* Delete Button */}
          <div className="relative shrink-0 group">
            <button
              onClick={() => removeNode(id)}
              disabled={isExecuting}
              className={`nodrag nopan p-0.5 rounded transition-all duration-200 ease-in-out flex items-center overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed ${
                hasColoredBg
                  ? "text-white/50 hover:text-red-300 border border-transparent hover:border-red-400/30"
                  : "text-neutral-600 hover:text-red-400 border border-transparent hover:border-red-500/30"
              }`}
              title="Delete this node"
            >
              <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
