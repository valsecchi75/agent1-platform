"use client";

import {
  ReactFlow,
  Background,
  NodeTypes,
  EdgeTypes,
  Connection,
  Edge,
  useReactFlow,
  OnConnectEnd,
  Node,
  OnSelectionChangeParams,
  ViewportPortal,
} from "@xyflow/react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState, useEffect, DragEvent, useMemo } from "react";
import "@xyflow/react/dist/style.css";

import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { AnnotationModal } from "./AnnotationModal";
import { ChatPanel } from "./ChatPanel";
import { ConnectionDropMenu, MenuAction } from "./ConnectionDropMenu";
import { EditableEdge, ReferenceEdge, SharedEdgeGradients } from "./edges";
import { buildNodeTypes } from "@/lib/nodePacks/nodeRegistry";
import { useToast } from "@/components/Toast";
import { useWorkflowStore, WorkflowFile } from "@/store/workflowStore";

// Lazy-load GLBViewerNode to avoid bundling three.js for users who don't use 3D nodes
const GLBViewerNode = dynamic(() => import("./nodes/GLBViewerNode").then(mod => ({ default: mod.GLBViewerNode })), { ssr: false });
import { MultiSelectToolbar } from "./MultiSelectToolbar";
import { EdgeToolbar } from "./EdgeToolbar";
import { GlobalImageHistory } from "./GlobalImageHistory";
import { GroupBackgroundsPortal, GroupControlsOverlay } from "./GroupsOverlay";
import { InteractiveGrid } from "./InteractiveGrid";
import CanvasToolbar from "./CanvasToolbar";
import { NodeType, NanoBananaNodeData, HandleType } from "@/types";
import { defaultNodeDimensions } from "@/store/utils/nodeDefaults";
import { FloatingNodeHeader } from "./nodes/FloatingNodeHeader";
import { ControlPanel } from "./nodes/ControlPanel";
import { browseRegistry } from "@/utils/browseRegistry";
import { detectAndSplitGrid } from "@/utils/gridSplitter";
import { logger } from "@/utils/logger";
import { WelcomeModal } from "./quickstart";
import { ProjectSetupModal } from "./ProjectSetupModal";
import { EditOperation } from "@/lib/chat/editOperations";
import { stripBinaryData } from "@/lib/chat/contextBuilder";
import { PromptEditorModal } from "./modals/PromptEditorModal";
import { useInlineParameters } from "@/hooks/useInlineParameters";
import { useCanvasKeyboard } from "@/hooks/useCanvasKeyboard";
import { getHandleType, getNodeHandles } from "@/utils/connectionValidation";
import { SplitGridSettingsModal } from "./SplitGridSettingsModal";
import { useAnnotationStore } from "@/store/annotationStore";

/** Type-safe accessor for node data properties that may not exist on all node types */
function getNodeDataProp<T = unknown>(data: Record<string, unknown>, key: string): T | undefined {
  return (data as Record<string, unknown>)[key] as T | undefined;
}

// R9.2: nodeTypes built dynamically from installed packs
// GLBViewerNode must be added separately as it's lazy-loaded
const GLB_ENTRY = { glbViewer: GLBViewerNode };

const edgeTypes: EdgeTypes = {
  editable: EditableEdge,
  reference: ReferenceEdge,
};

// Connection validation rules — see @/utils/connectionValidation for getHandleType and getNodeHandles

interface ConnectionDropState {
  position: { x: number; y: number };
  flowPosition: { x: number; y: number };
  handleType: "image" | "text" | "video" | "audio" | "3d" | "easeCurve" | null;
  connectionType: "source" | "target";
  sourceNodeId: string | null;
  sourceHandleId: string | null;
}

// Detect if running on macOS for platform-specific trackpad behavior
const isMacOS = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

// Detect if a wheel event is from a mouse (vs trackpad)
const isMouseWheel = (event: WheelEvent): boolean => {
  // Mouse scroll wheel typically uses deltaMode 1 (lines) or has large discrete deltas
  // Trackpad uses deltaMode 0 (pixels) with smaller, smoother deltas
  if (event.deltaMode === 1) return true; // DOM_DELTA_LINE = mouse

  // Fallback: large delta values suggest mouse wheel
  const threshold = 50;
  return Math.abs(event.deltaY) >= threshold &&
         Math.abs(event.deltaY) % 40 === 0; // Mouse deltas often in multiples
};

// Check if an element can scroll and has room to scroll in the given direction
const canElementScroll = (element: HTMLElement, deltaX: number, deltaY: number): boolean => {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;

  const canScrollY = overflowY === 'auto' || overflowY === 'scroll';
  const canScrollX = overflowX === 'auto' || overflowX === 'scroll';

  // Check if there's room to scroll in the delta direction
  if (canScrollY && deltaY !== 0) {
    const hasVerticalScroll = element.scrollHeight > element.clientHeight;
    if (hasVerticalScroll) {
      // Check if we can scroll further in the delta direction
      if (deltaY > 0 && element.scrollTop < element.scrollHeight - element.clientHeight) {
        return true; // Can scroll down
      }
      if (deltaY < 0 && element.scrollTop > 0) {
        return true; // Can scroll up
      }
    }
  }

  if (canScrollX && deltaX !== 0) {
    const hasHorizontalScroll = element.scrollWidth > element.clientWidth;
    if (hasHorizontalScroll) {
      if (deltaX > 0 && element.scrollLeft < element.scrollWidth - element.clientWidth) {
        return true; // Can scroll right
      }
      if (deltaX < 0 && element.scrollLeft > 0) {
        return true; // Can scroll left
      }
    }
  }

  return false;
};

// Find if the target element or any ancestor is scrollable
const findScrollableAncestor = (target: HTMLElement, deltaX: number, deltaY: number): HTMLElement | null => {
  let current: HTMLElement | null = target;

  while (current && !current.classList.contains('react-flow')) {
    // Check for nowheel class (React Flow convention for elements that should handle their own scroll)
    if (current.classList.contains('nowheel') || current.tagName === 'TEXTAREA') {
      if (canElementScroll(current, deltaX, deltaY)) {
        return current;
      }
    }
    current = current.parentElement;
  }

  return null;
};

/** Shared ref so child components (BaseNode) can check panning state without re-rendering */
export const isPanningRef = { current: false };
/** Shared ref so child components (BaseNode) can skip hover updates during node drags */
export const isDraggingNodeRef = { current: false };

export function WorkflowCanvas() {
  const { nodes, edges, groups, isModalOpen, showQuickstart, navigationTarget, canvasNavigationSettings, dimmedNodeIds } =
    useWorkflowStore(useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      groups: state.groups,
      isModalOpen: state.isModalOpen,
      showQuickstart: state.showQuickstart,
      navigationTarget: state.navigationTarget,
      canvasNavigationSettings: state.canvasNavigationSettings,
      dimmedNodeIds: state.dimmedNodeIds,
    })));
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const addNode = useWorkflowStore((state) => state.addNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const loadWorkflow = useWorkflowStore((state) => state.loadWorkflow);
  const getNodeById = useWorkflowStore((state) => state.getNodeById);
  const addToGlobalHistory = useWorkflowStore((state) => state.addToGlobalHistory);
  const setNodeGroupId = useWorkflowStore((state) => state.setNodeGroupId);
  const executeWorkflow = useWorkflowStore((state) => state.executeWorkflow);
  const setShowQuickstart = useWorkflowStore((state) => state.setShowQuickstart);
  const setNavigationTarget = useWorkflowStore((state) => state.setNavigationTarget);
  const captureSnapshot = useWorkflowStore((state) => state.captureSnapshot);
  const applyEditOperations = useWorkflowStore((state) => state.applyEditOperations);
  const setWorkflowMetadata = useWorkflowStore((state) => state.setWorkflowMetadata);
  const setShortcutsDialogOpen = useWorkflowStore((state) => state.setShortcutsDialogOpen);
  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const clearWorkflow = useWorkflowStore((state) => state.clearWorkflow);
  const setHoveredNodeId = useWorkflowStore((state) => state.setHoveredNodeId);
  const openAnnotationModal = useAnnotationStore((state) => state.openModal);
  const { screenToFlowPosition, getViewport, zoomIn, zoomOut, setViewport, setCenter } = useReactFlow();
  const { show: showToast } = useToast();

  // Minimap node color callback (stable reference via useCallback)
  const minimapNodeColor = useCallback((node: { type?: string }) => {
    switch (node.type) {
      case "imageInput": return "#3b82f6";
      case "audioInput": return "#a78bfa";
      case "videoInput": return "#14b8a6";
      case "annotation": return "#8b5cf6";
      case "prompt": return "#f97316";
      case "array": return "#a3e635";
      case "promptConstructor": return "#f472b6";
      case "nanoBanana": return "#22c55e";
      case "generateVideo": return "#9333ea";
      case "generate3d": return "#fb923c";
      case "generateAudio": return "#d946ef";
      case "llmGenerate": return "#06b6d4";
      case "splitGrid": return "#f59e0b";
      case "output": return "#ef4444";
      case "outputGallery": return "#ec4899";
      case "imageCompare": return "#14b8a6";
      case "videoStitch": return "#f97316";
      case "easeCurve": return "#bef264";
      case "videoTrim": return "#60a5fa";
      case "videoFrameGrab": return "#38bdf8";
      case "router": return "#6b7280";
      case "switch": return "#8b5cf6";
      case "conditionalSwitch": return "#06b6d4";
      case "glbViewer": return "#0ea5e9";
      default: return "#94a3b8";
    }
  }, []);

  const [isDragOver, setIsDragOver] = useState(false);
  const [dropType, setDropType] = useState<"image" | "audio" | "workflow" | "node" | null>(null);
  const [connectionDrop, setConnectionDrop] = useState<ConnectionDropState | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBuildingWorkflow, setIsBuildingWorkflow] = useState(false);
  const [showNewProjectSetup, setShowNewProjectSetup] = useState(false);
  const [expandingNode, setExpandingNode] = useState<{ id: string; type: string } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [edgesHidden, setEdgesHidden] = useState(false);

  // R9.2: nodeTypes built dynamically from installed packs (hydrated by NodePackChecker)
  const activeNodeTypes = useWorkflowStore((s) => s.activeNodeTypes);
  const nodeTypes = useMemo(() => {
    const dynamic = buildNodeTypes(activeNodeTypes);
    return { ...dynamic, ...GLB_ENTRY };
  }, [activeNodeTypes]);

  // Listen for toolbar events (cursor mode, toggle links)
  useEffect(() => {
    const onToggleLinks = (e: Event) => setEdgesHidden(!(e as CustomEvent).detail);
    const onCursorMode = (e: Event) => {
      const mode = (e as CustomEvent).detail;
      // When "hand" mode: panOnDrag everywhere. "select" mode: default behavior.
      // We store it and use it in the ReactFlow props below.
      setCursorModeFromToolbar(mode);
      // Sync CSS cursor: add/remove canvas-hand-mode class on <html> so CSS can
      // override the pane cursor to grab/grabbing without a React re-render.
      if (mode === "hand") {
        document.documentElement.classList.add("canvas-hand-mode");
      } else {
        document.documentElement.classList.remove("canvas-hand-mode");
      }
    };
    window.addEventListener("canvas-toggle-links", onToggleLinks);
    window.addEventListener("canvas-cursor-mode", onCursorMode);
    return () => {
      window.removeEventListener("canvas-toggle-links", onToggleLinks);
      window.removeEventListener("canvas-cursor-mode", onCursorMode);
    };
  }, []);
  const [cursorModeFromToolbar, setCursorModeFromToolbar] = useState<"select" | "hand">("select");

  // Detect if canvas is empty for showing quickstart
  const isCanvasEmpty = nodes.length === 0;

  // Handle comment navigation - center viewport on target node
  useEffect(() => {
    if (navigationTarget) {
      const targetNode = nodes.find((n) => n.id === navigationTarget.nodeId);
      if (targetNode) {
        // Calculate center of node
        const nodeWidth = (targetNode.style?.width as number) || 300;
        const nodeHeight = (targetNode.style?.height as number) || 280;
        const centerX = targetNode.position.x + nodeWidth / 2;
        const centerY = targetNode.position.y + nodeHeight / 2;

        // Navigate to node center with animation, zoomed out to 0.7 for better context
        setCenter(centerX, centerY, { duration: 300, zoom: 0.7 });
      }
      // Clear navigation target after navigating
      setNavigationTarget(null);
    }
  }, [navigationTarget, nodes, setCenter, setNavigationTarget]);

  // Apply dimming className to nodes downstream of disabled Switch outputs
  const allNodes = useMemo(() => {
    return nodes.map((node) => {
      // Never dim Switch or ConditionalSwitch nodes themselves
      if (node.type === "switch" || node.type === "conditionalSwitch") return node;

      const isDimmed = dimmedNodeIds.has(node.id);
      const dimClass = isDimmed ? "switch-dimmed" : "";

      // Preserve existing className if any, add/remove dimmed class
      const baseClass = (node.className || "").replace(/\bswitch-dimmed\b/g, "").trim();
      const newClass = dimClass ? `${baseClass} ${dimClass}`.trim() : baseClass;

      // Only create new node object if className changed
      if (node.className === newClass) return node;
      return { ...node, className: newClass };
    });
  }, [nodes, dimmedNodeIds]);

  // Node title mapping for FloatingNodeHeaders
  const NODE_TITLES: Record<string, string> = {
    imageInput: 'Image Input',
    audioInput: 'Audio Input',
    annotation: 'Annotation',
    prompt: 'Prompt',
    array: 'Array',
    promptConstructor: 'Prompt Constructor',
    nanoBanana: 'Generate Image',
    generateVideo: 'Generate Video',
    generate3d: 'Generate 3D',
    generateAudio: 'Generate Audio',
    llmGenerate: 'LLM Generate',
    splitGrid: 'Split Grid',
    output: 'Output',
    outputGallery: 'Output Gallery',
    imageCompare: 'Image Compare',
    videoStitch: 'Video Stitch',
    easeCurve: 'Ease Curve',
    videoTrim: 'Video Trim',
    videoFrameGrab: 'Frame Grab',
    router: 'Router',
    switch: 'Switch',
    conditionalSwitch: 'Conditional Switch',
    glbViewer: '3D Viewer',
    // Neural Atelier custom nodes
    naSketchToPhoto: 'NA — Sketch to Photo',
    naStylingDetail: 'NA — Styling Detail',
    naRecolor: 'NA — Recolor',
    // Morpheus custom nodes
    morpheusModelManagement: 'Morpheus Model Management',
    // Foundation utility nodes
    previewImage: 'Preview Image',
    showAnything: 'Show Anything',
  };

  // Helper to get node title (used for FloatingNodeHeader)
  const getNodeTitle = useCallback((node: Node) => {
    // For generate nodes, check for selectedModel display name
    if (node.type === "nanoBanana" || node.type === "generateVideo" || node.type === "generate3d" || node.type === "generateAudio") {
      const model = getNodeDataProp<{ displayName?: string; name?: string }>(node.data, 'selectedModel');
      if (model?.displayName) return model.displayName;
    }

    // For LLM nodes, check for selectedLLMModel or selectedModel
    if (node.type === "llmGenerate") {
      const model = getNodeDataProp<{ displayName?: string; name?: string }>(node.data, 'selectedLLMModel') || getNodeDataProp<{ displayName?: string; name?: string }>(node.data, 'selectedModel');
      if (model?.displayName) return model.displayName;
      if (model?.name) return model.name;
    }

    return NODE_TITLES[node.type || ""] || "Node";
  }, []);


  // Wire comment/title change callbacks for FloatingNodeHeaders
  const handleCustomTitleChange = useCallback((nodeId: string, title: string) => {
    updateNodeData(nodeId, { customTitle: title || undefined });
  }, [updateNodeData]);

  const handleCommentChange = useCallback((nodeId: string, comment: string) => {
    updateNodeData(nodeId, { comment: comment || undefined });
  }, [updateNodeData]);

  // Stable callback for running a node from its header
  const handleRunNode = useCallback((nodeId: string) => {
    regenerateNode(nodeId);
  }, [regenerateNode]);

  // Inline parameters mode (for showing Browse in header)
  const { inlineParametersEnabled } = useInlineParameters();

  // Stable callback for expanding a node from its header
  const handleExpandNode = useCallback((nodeId: string, nodeType: string) => {
    if (nodeType === 'annotation') {
      const node = getNodeById(nodeId);
      if (!node) return;
      const imageToEdit = getNodeDataProp<string>(node.data, 'outputImage') || getNodeDataProp<string>(node.data, 'image');
      if (!imageToEdit) return;
      openAnnotationModal(nodeId, imageToEdit, getNodeDataProp(node.data, 'annotations'));
    } else {
      setExpandingNode({ id: nodeId, type: nodeType });
    }
  }, [getNodeById, openAnnotationModal]);


  // Check if a node was dropped into a group and add it to that group
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Skip if it's a group node
      if (node.id.startsWith("group-")) return;

      const defaults = defaultNodeDimensions[node.type as NodeType] || { width: 300, height: 280 };
      const nodeWidth = node.measured?.width || (node.style?.width as number) || defaults.width;
      const nodeHeight = node.measured?.height || (node.style?.height as number) || defaults.height;
      const nodeCenterX = node.position.x + nodeWidth / 2;
      const nodeCenterY = node.position.y + nodeHeight / 2;

      // Check if node center is inside any group
      let targetGroupId: string | undefined;

      for (const group of Object.values(groups)) {
        const inBoundsX = nodeCenterX >= group.position.x && nodeCenterX <= group.position.x + group.size.width;
        const inBoundsY = nodeCenterY >= group.position.y && nodeCenterY <= group.position.y + group.size.height;

        if (inBoundsX && inBoundsY) {
          targetGroupId = group.id;
          break;
        }
      }

      // Get current groupId of the node
      const currentNode = nodes.find((n) => n.id === node.id);
      const currentGroupId = currentNode?.groupId;

      // Update groupId if it changed
      if (targetGroupId !== currentGroupId) {
        setNodeGroupId(node.id, targetGroupId);
      }
    },
    [groups, nodes, setNodeGroupId]
  );

  // R9.1: Pre-compute nodeMap for O(1) lookups instead of O(n) find() calls
  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  // Connection validation - checks if a connection is valid based on handle types and node types
  // Defined inside component to have access to nodes array for video validation
  const isValidConnection = useCallback(
    (connection: Connection | Edge): boolean => {
      const sourceType = getHandleType(connection.sourceHandle);
      const targetType = getHandleType(connection.targetHandle);

      // Switch input: accept any type (generic-input handle)
      const targetNode = nodeMap.get(connection.target);
      const sourceNode = nodeMap.get(connection.source);
      if (targetNode?.type === "switch" && connection.targetHandle === "generic-input") return true;

      // Switch output: the type is determined by inputType stored in node data
      if (sourceNode?.type === "switch") {
        const switchData = sourceNode.data as { inputType?: string | null };
        if (switchData.inputType && targetType) {
          return switchData.inputType === targetType;
        }
        // If inputType not set yet, allow connection (will be resolved)
        return true;
      }

      // Conditional Switch: text input only, text outputs only
      if (targetNode?.type === "conditionalSwitch") {
        return sourceType === "text";
      }
      if (sourceNode?.type === "conditionalSwitch") {
        return targetType === "text";
      }

      // If we can't determine types, allow the connection
      if (!sourceType || !targetType) return true;

      // EaseCurve connections: only between easeCurve nodes (or router)
      if (sourceType === "easeCurve" || targetType === "easeCurve") {
        const targetNode = nodeMap.get(connection.target);
        const sourceNode = nodeMap.get(connection.source);
        if (targetNode?.type === "router" || sourceNode?.type === "router") return true;
        if (sourceType !== "easeCurve" || targetType !== "easeCurve") return false;
        return targetNode?.type === "easeCurve";
      }

      // Video connections have special rules
      if (sourceType === "video") {
        // Video source can ONLY connect to:
        // 1. generateVideo nodes (for video-to-video)
        // 2. videoStitch nodes (for concatenation)
        // 3. output nodes (for display)
        const targetNode = nodeMap.get(connection.target);
        if (!targetNode) return false;

        const targetNodeType = targetNode.type;
        if (targetNodeType === "generateVideo" || targetNodeType === "videoStitch" || targetNodeType === "easeCurve" || targetNodeType === "videoTrim" || targetNodeType === "videoFrameGrab" || targetNodeType === "output" || targetNodeType === "router") {
          // For output node, we allow video even though its handle is typed as "image"
          // because output node can display both images and videos
          return true;
        }
        // Video cannot connect to other node types
        return false;
      }

      // 3D connections: 3d handles can only connect to matching 3d handles (or router)
      if (sourceType === "3d" || targetType === "3d") {
        // Allow 3d connections to router nodes
        const sourceNode = nodeMap.get(connection.source);
        const targetNode = nodeMap.get(connection.target);
        if (sourceNode?.type === "router" || targetNode?.type === "router") return true;
        return sourceType === "3d" && targetType === "3d";
      }

      // Audio connections: audio handles connect to audio handles, plus output/generateVideo/router nodes
      if (sourceType === "audio" || targetType === "audio") {
        if (sourceType === "audio") {
          const targetNode = nodeMap.get(connection.target);
          if (targetNode?.type === "output" || targetNode?.type === "router" || targetNode?.type === "generateVideo") return true;
        }
        return sourceType === "audio" && targetType === "audio";
      }

      // Standard type matching for image and text
      // Image handles connect to image handles, text handles connect to text handles
      return sourceType === targetType;
    },
    [nodeMap]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;

      // For imageCompare nodes, redirect to the second handle if the first is occupied
      const resolveImageCompareHandle = (conn: Connection, batchUsed?: Set<string>): Connection => {
        const targetNode = nodes.find((n) => n.id === conn.target);
        if (targetNode?.type === "imageCompare" && conn.targetHandle === "image") {
          const imageOccupied = edges.some(
            (e) => e.target === conn.target && e.targetHandle === "image"
          ) || batchUsed?.has("image");
          if (imageOccupied) {
            return { ...conn, targetHandle: "image-1" };
          }
        }
        return conn;
      };

      // For Router nodes, resolve generic handles to typed handles
      const resolveRouterHandle = (conn: Connection): Connection => {
        const targetNode = nodes.find((n) => n.id === conn.target);
        if (targetNode?.type !== "router") return conn;

        // If targeting a generic handle, transform to typed handle
        if (conn.targetHandle === "generic-input") {
          const sourceType = getHandleType(conn.sourceHandle);
          if (sourceType) {
            return { ...conn, targetHandle: sourceType };
          }
        }
        return conn;
      };

      // For Router source nodes, resolve generic output handles to typed handles
      const resolveRouterSourceHandle = (conn: Connection): Connection => {
        const sourceNode = nodes.find((n) => n.id === conn.source);
        if (sourceNode?.type !== "router") return conn;
        if (conn.sourceHandle === "generic-output") {
          const targetType = getHandleType(conn.targetHandle);
          if (targetType) {
            return { ...conn, sourceHandle: targetType };
          }
        }
        return conn;
      };

      // For Switch nodes, resolve generic-input to the source's handle type and update inputType
      const resolveSwitchHandle = (conn: Connection): Connection => {
        const targetNode = nodes.find((n) => n.id === conn.target);
        if (targetNode?.type !== "switch") return conn;

        // If targeting the generic-input handle, resolve to the source handle type
        if (conn.targetHandle === "generic-input") {
          const sourceType = getHandleType(conn.sourceHandle);
          if (sourceType) {
            // Update the Switch node's inputType in data so output handles render
            updateNodeData(conn.target, { inputType: sourceType as HandleType });
            return { ...conn, targetHandle: sourceType };
          }
        }
        return conn;
      };

      // Get all selected nodes
      const selectedNodes = nodes.filter((node) => node.selected);
      const sourceNode = nodes.find((node) => node.id === connection.source);

      // If the source node is selected and there are multiple selected nodes,
      // connect all selected nodes that have the same source handle type
      if (sourceNode?.selected && selectedNodes.length > 1 && connection.sourceHandle) {
        const batchUsed = new Set<string>();

        selectedNodes.forEach((node) => {
          // Skip if this is already the connection source
          if (node.id === connection.source) {
            let resolved = resolveImageCompareHandle(connection, batchUsed);
            resolved = resolveRouterHandle(resolved);
            resolved = resolveRouterSourceHandle(resolved);
            resolved = resolveSwitchHandle(resolved);
            // Resolve videoStitch handles for batch connections
            const tgtNode = nodes.find((n) => n.id === resolved.target);
            if (tgtNode?.type === "videoStitch" && resolved.targetHandle?.startsWith("video-")) {
              for (let i = 0; i < 50; i++) {
                const candidateHandle = `video-${i}`;
                const isOccupied = edges.some(
                  (e) => e.target === resolved.target && e.targetHandle === candidateHandle
                ) || batchUsed.has(candidateHandle);
                if (!isOccupied) {
                  resolved = { ...resolved, targetHandle: candidateHandle };
                  batchUsed.add(candidateHandle);
                  break;
                }
              }
            }
            if (resolved.targetHandle) batchUsed.add(resolved.targetHandle);
            onConnect(resolved);
            return;
          }

          // Check if this node actually has the same output handle type
          const nodeHandles = getNodeHandles(node.type || "");
          if (!nodeHandles.outputs.includes(connection.sourceHandle as string)) {
            // This node doesn't have the same output handle type, skip it
            return;
          }

          // Create connection from this selected node to the same target
          let multiConnection: Connection = {
            source: node.id,
            sourceHandle: connection.sourceHandle,
            target: connection.target,
            targetHandle: connection.targetHandle,
          };

          // Resolve videoStitch handle for batch connections
          const targetNode = nodes.find((n) => n.id === multiConnection.target);
          if (targetNode?.type === "videoStitch" && multiConnection.targetHandle?.startsWith("video-")) {
            for (let i = 0; i < 50; i++) {
              const candidateHandle = `video-${i}`;
              const isOccupied = edges.some(
                (e) => e.target === multiConnection.target && e.targetHandle === candidateHandle
              ) || batchUsed.has(candidateHandle);
              if (!isOccupied) {
                multiConnection = { ...multiConnection, targetHandle: candidateHandle };
                batchUsed.add(candidateHandle);
                break;
              }
            }
          }

          let resolved = resolveImageCompareHandle(multiConnection, batchUsed);
          resolved = resolveRouterHandle(resolved);
          resolved = resolveRouterSourceHandle(resolved);
          resolved = resolveSwitchHandle(resolved);
          if (resolved.targetHandle) batchUsed.add(resolved.targetHandle);
          if (isValidConnection(resolved)) {
            onConnect(resolved);
          }
        });
      } else {
        // Single connection
        let resolved = resolveImageCompareHandle(connection);
        resolved = resolveRouterHandle(resolved);
        resolved = resolveRouterSourceHandle(resolved);
        resolved = resolveSwitchHandle(resolved);
        onConnect(resolved);
      }
    },
    [onConnect, nodes, edges]
  );

  // Handle connection dropped on empty space or on a node
  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // If connection was completed normally, nothing to do
      if (connectionState.isValid || !connectionState.fromNode) {
        return;
      }

      const { clientX, clientY } = event as MouseEvent;
      const fromHandleId = connectionState.fromHandle?.id || null;
      let fromHandleType = getHandleType(fromHandleId); // Use getHandleType for dynamic handles
      const isFromSource = connectionState.fromHandle?.type === "source";

      // Switch output handles have dynamic IDs — resolve type from node's inputType
      if (!fromHandleType && connectionState.fromNode.type === "switch") {
        const switchData = connectionState.fromNode.data as { inputType?: string | null };
        if (switchData.inputType) {
          fromHandleType = switchData.inputType as "image" | "text" | "video" | "audio" | "3d" | "easeCurve";
        }
      }

      // ConditionalSwitch output handles have dynamic IDs (rule-xxx, default) — always text type
      if (!fromHandleType && connectionState.fromNode.type === "conditionalSwitch") {
        fromHandleType = "text";
      }

      // Helper to find a compatible handle on a node by type
      const findCompatibleHandle = (
        node: Node,
        handleType: "image" | "text" | "video" | "audio" | "3d" | "easeCurve",
        needInput: boolean,
        batchUsed?: Set<string>
      ): string | null => {
        // Check for dynamic inputSchema first
        const nodeData = node.data as { inputSchema?: Array<{ name: string; type: string }> };
        if (nodeData.inputSchema && nodeData.inputSchema.length > 0) {
          if (needInput) {
            // Find input handles matching the type
            const matchingInputs = nodeData.inputSchema.filter(i => i.type === handleType);
            const numHandles = matchingInputs.length;
            if (numHandles > 0) {
              // Find the first unoccupied indexed handle by checking existing edges and batchUsed
              for (let i = 0; i < numHandles; i++) {
                const candidateHandle = `${handleType}-${i}`;
                const isOccupied = edges.some(
                  (edge) => edge.target === node.id && edge.targetHandle === candidateHandle
                ) || batchUsed?.has(candidateHandle);
                if (!isOccupied) {
                  return candidateHandle;
                }
              }
              // All handles are occupied
              return null;
            }
          }
          // Output handle - check for video, 3d, or image type
          if (handleType === "video") return "video";
          if (handleType === "3d") return "3d";
          return handleType === "image" ? "image" : null;
        }

        // VideoStitch has dynamic indexed video input handles (video-0, video-1, ...)
        if (node.type === "videoStitch" && needInput && handleType === "video") {
          for (let i = 0; i < 50; i++) {
            const candidateHandle = `video-${i}`;
            const isOccupied = edges.some(
              (edge) => edge.target === node.id && edge.targetHandle === candidateHandle
            ) || batchUsed?.has(candidateHandle);
            if (!isOccupied) return candidateHandle;
          }
          return null;
        }

        // Router accepts any type — use typed handle if exists, otherwise generic
        if (node.type === "router" && needInput) {
          // Router accepts any type — use typed handle if that type is already active
          return handleType;
        }
        if (node.type === "router" && !needInput) {
          return handleType;
        }

        // Switch accepts any type on input, outputs match inputType
        if (node.type === "switch" && needInput) {
          return "generic-input";
        }
        if (node.type === "switch" && !needInput) {
          const switchData = node.data as { switches?: Array<{ id: string; enabled: boolean }> };
          // Return first enabled switch output handle ID
          if (switchData.switches && switchData.switches.length > 0) {
            const firstEnabled = switchData.switches.find(s => s.enabled);
            if (firstEnabled) return firstEnabled.id;
          }
          return null;
        }

        // Conditional Switch: text input, dynamic rule outputs
        if (node.type === "conditionalSwitch" && handleType === "text") {
          if (needInput) {
            return "text";
          } else {
            // Return first rule ID from node data
            const condData = node.data as { rules?: Array<{ id: string }> };
            if (condData.rules && condData.rules.length > 0) {
              return condData.rules[0].id;
            }
            return "default";
          }
        }

        // Fall back to static handles
        const staticHandles = getNodeHandles(node.type || "");
        const handleList = needInput ? staticHandles.inputs : staticHandles.outputs;

        // First try exact match
        if (handleList.includes(handleType)) return handleType;

        // For video output connecting to output node, allow "image" input (output node accepts both)
        if (handleType === "video" && needInput && node.type === "output") {
          return "image";
        }

        // For audio output connecting to output node, use the "audio" input handle
        if (handleType === "audio" && needInput && node.type === "output") {
          return "audio";
        }

        // Then check each handle's type
        for (const h of handleList) {
          if (getHandleType(h) === handleType) return h;
        }

        return null;
      };

      // Check if we dropped on a node by looking for node elements under the cursor
      const elementsUnderCursor = document.elementsFromPoint(clientX, clientY);
      const nodeElement = elementsUnderCursor.find((el) => {
        // React Flow nodes have data-id attribute
        return el.closest(".react-flow__node");
      });

      if (nodeElement) {
        const nodeWrapper = nodeElement.closest(".react-flow__node") as HTMLElement;
        const targetNodeId = nodeWrapper?.dataset.id;

        if (targetNodeId && targetNodeId !== connectionState.fromNode.id && fromHandleType) {
          const targetNode = nodes.find((n) => n.id === targetNodeId);

          if (targetNode) {
            // Find a compatible handle on the target node
            const compatibleHandle = findCompatibleHandle(
              targetNode,
              fromHandleType,
              isFromSource // need input if dragging from output
            );

            if (compatibleHandle) {
              // Create the connection
              const connection: Connection = isFromSource
                ? {
                    source: connectionState.fromNode.id,
                    sourceHandle: fromHandleId,
                    target: targetNodeId,
                    targetHandle: compatibleHandle,
                  }
                : {
                    source: targetNodeId,
                    sourceHandle: compatibleHandle,
                    target: connectionState.fromNode.id,
                    targetHandle: fromHandleId,
                  };

              if (isValidConnection(connection)) {
                handleConnect(connection);
                return; // Connection made, don't show menu
              }
            }
          }
        }
      }

      // No node under cursor or no compatible handle - show the drop menu
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });

      setConnectionDrop({
        position: { x: clientX, y: clientY },
        flowPosition: flowPos,
        handleType: fromHandleType,
        connectionType: isFromSource ? "source" : "target",
        sourceNodeId: connectionState.fromNode.id,
        sourceHandleId: fromHandleId,
      });
    },
    [screenToFlowPosition, nodes, edges, handleConnect]
  );

  // Handle the splitGrid action - uses automated grid detection
  const handleSplitGridAction = useCallback(
    async (sourceNodeId: string, flowPosition: { x: number; y: number }) => {
      const sourceNode = getNodeById(sourceNodeId);
      if (!sourceNode) return;

      // Get the output image from the source node
      let sourceImage: string | null = null;
      if (sourceNode.type === "nanoBanana") {
        sourceImage = (sourceNode.data as NanoBananaNodeData).outputImage;
      } else if (sourceNode.type === "imageInput") {
        sourceImage = (sourceNode.data as { image: string | null }).image;
      } else if (sourceNode.type === "annotation") {
        sourceImage = (sourceNode.data as { outputImage: string | null }).outputImage;
      }

      if (!sourceImage) {
        alert("No image available to split. Generate or load an image first.");
        return;
      }

      const sourceNodeData = sourceNode.type === "nanoBanana" ? sourceNode.data as NanoBananaNodeData : null;
      setIsSplitting(true);

      try {
        const { grid, images } = await detectAndSplitGrid(sourceImage);

        if (images.length === 0) {
          alert("Could not detect grid in image.");
          setIsSplitting(false);
          return;
        }

        // Calculate layout for the new nodes
        const nodeWidth = 300;
        const nodeHeight = 280;
        const gap = 20;

        // Add split images to global history
        images.forEach((imageData: string, index: number) => {
          const row = Math.floor(index / grid.cols);
          const col = index % grid.cols;
          addToGlobalHistory({
            image: imageData,
            timestamp: Date.now() + index,
            prompt: `Split ${row + 1}-${col + 1} from ${grid.rows}x${grid.cols} grid`,
            aspectRatio: sourceNodeData?.aspectRatio || "1:1",
            model: sourceNodeData?.model || "nano-banana",
          });
        });

        // Create ImageInput nodes arranged in a grid matching the layout
        images.forEach((imageData: string, index: number) => {
          const row = Math.floor(index / grid.cols);
          const col = index % grid.cols;

          const nodeId = addNode("imageInput", {
            x: flowPosition.x + col * (nodeWidth + gap),
            y: flowPosition.y + row * (nodeHeight + gap),
          });

          // Get dimensions from the split image
          const img = new Image();
          img.onload = () => {
            updateNodeData(nodeId, {
              image: imageData,
              filename: `split-${row + 1}-${col + 1}.png`,
              dimensions: { width: img.width, height: img.height },
            });
          };
          img.src = imageData;
        });

      } catch (error) {
        console.error("[SplitGrid] Error:", error);
        alert("Failed to split image grid: " + (error instanceof Error ? error.message : "Unknown error"));
      } finally {
        setIsSplitting(false);
      }
    },
    [getNodeById, addNode, updateNodeData, addToGlobalHistory]
  );

  // Helper to get image from a node
  const getImageFromNode = useCallback((nodeId: string): string | null => {
    const node = getNodeById(nodeId);
    if (!node) return null;

    switch (node.type) {
      case "imageInput":
        return (node.data as { image: string | null }).image;
      case "annotation":
        return (node.data as { outputImage: string | null }).outputImage;
      case "nanoBanana":
        return (node.data as { outputImage: string | null }).outputImage;
      default:
        return null;
    }
  }, [getNodeById]);

  // Handle workflow generation from chat conversation
  const handleBuildWorkflow = useCallback(async (description: string) => {
    setIsBuildingWorkflow(true);
    try {
      const response = await fetch("/api/quickstart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          contentLevel: "full",
        }),
      });

      const data = await response.json();

      if (data.success && data.workflow) {
        captureSnapshot(); // Capture BEFORE loading new workflow
        await loadWorkflow(data.workflow, undefined, { preserveSnapshot: true });
        setIsChatOpen(false);
        showToast("Workflow generated successfully", "success");
      } else {
        showToast(data.error || "Failed to generate workflow", "error");
      }
    } catch (error) {
      console.error("Error generating workflow:", error);
      showToast("Failed to generate workflow. Please try again.", "error");
    } finally {
      setIsBuildingWorkflow(false);
    }
  }, [loadWorkflow, showToast, captureSnapshot]);

  // Create lightweight workflow state for chat (strip base64 images)
  const chatWorkflowState = useMemo(() => {
    const strippedNodes = stripBinaryData(nodes);
    return {
      nodes: strippedNodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
      })),
    };
  }, [nodes, edges]);

  // Compute selected node IDs for chat context scoping
  const selectedNodeIds = useMemo(() => nodes.filter(n => n.selected).map(n => n.id), [nodes]);

  // Handle applying edit operations from chat
  const handleApplyEdits = useCallback((operations: EditOperation[]) => {
    captureSnapshot(); // Snapshot before AI edits
    const result = applyEditOperations(operations);
    if (result.applied > 0) {
      showToast(`Applied ${result.applied} edit(s)`, "success");
    }
    if (result.skipped.length > 0) {
      console.warn('Skipped operations:', result.skipped);
    }
    return result;
  }, [captureSnapshot, applyEditOperations, showToast]);

  // Handle node selection from drop menu
  const handleMenuSelect = useCallback(
    (selection: { type: NodeType | MenuAction; isAction: boolean }) => {
      if (!connectionDrop) return;

      const { flowPosition, sourceNodeId, sourceHandleId, connectionType, handleType } = connectionDrop;

      // Handle actions differently from node creation
      if (selection.isAction) {
        if (selection.type === "splitGridImmediate" && sourceNodeId) {
          handleSplitGridAction(sourceNodeId, flowPosition);
        }
        setConnectionDrop(null);
        return;
      }

      // Regular node creation
      const nodeType = selection.type as NodeType;

      // Create the new node at the drop position
      const newNodeId = addNode(nodeType, flowPosition);

      // If creating an annotation node from an image source, populate it with the source image
      if (nodeType === "annotation" && connectionType === "source" && handleType === "image" && sourceNodeId) {
        const sourceImage = getImageFromNode(sourceNodeId);
        if (sourceImage) {
          updateNodeData(newNodeId, { sourceImage, outputImage: sourceImage });
        }
      }

      // Determine the correct handle IDs for the new node based on its type
      let targetHandleId: string | null = null;
      let sourceHandleIdForNewNode: string | null = null;

      // Map handle type to the correct handle ID based on node type
      // Note: New nodes start with default handles (image, text) before a model is selected

      // Router accepts and outputs all types — use the connection's handle type
      if (nodeType === "router") {
        if (handleType) {
          targetHandleId = handleType;
          sourceHandleIdForNewNode = handleType;
        }
      } else if (nodeType === "switch") {
        // Switch input: use the actual type so the edge stores the correct handle type
        // (onConnect bypasses resolveSwitchHandle, so we must resolve here)
        targetHandleId = handleType || "generic-input";
        if (handleType) {
          updateNodeData(newNodeId, { inputType: handleType as HandleType });
        }
        // Switch outputs use dynamic handle IDs (switch entry IDs)
        sourceHandleIdForNewNode = null;
      } else if (nodeType === "conditionalSwitch") {
        // Conditional Switch: text input and dynamic rule outputs
        targetHandleId = "text";
        // Source handle is the first rule ID or "default"
        const nodeDataCheck = nodes.find(n => n.id === newNodeId);
        if (nodeDataCheck && nodeDataCheck.data) {
          const condData = nodeDataCheck.data as { rules?: Array<{ id: string }> };
          sourceHandleIdForNewNode = condData.rules && condData.rules.length > 0 ? condData.rules[0].id : "default";
        } else {
          sourceHandleIdForNewNode = "default";
        }
      } else if (handleType === "image") {
        if (nodeType === "annotation" || nodeType === "output" || nodeType === "splitGrid" || nodeType === "outputGallery" || nodeType === "imageCompare") {
          targetHandleId = "image";
          // annotation also has an image output
          if (nodeType === "annotation") {
            sourceHandleIdForNewNode = "image";
          }
        } else if (nodeType === "nanoBanana" || nodeType === "generateVideo") {
          targetHandleId = "image";
        } else if (nodeType === "imageInput") {
          sourceHandleIdForNewNode = "image";
        }
      } else if (handleType === "text") {
        if (nodeType === "nanoBanana" || nodeType === "generateVideo" || nodeType === "generateAudio" || nodeType === "llmGenerate") {
          targetHandleId = "text";
          // llmGenerate also has a text output
          if (nodeType === "llmGenerate") {
            sourceHandleIdForNewNode = "text";
          }
        } else if (nodeType === "prompt" || nodeType === "promptConstructor" || nodeType === "array") {
          // prompt, promptConstructor, and array can receive and output text
          targetHandleId = "text";
          sourceHandleIdForNewNode = "text";
        }
      } else if (handleType === "video") {
        if (nodeType === "videoStitch") {
          // VideoStitch has dynamic video-N inputs and a video output
          targetHandleId = "video-0";
          sourceHandleIdForNewNode = "video";
        } else if (nodeType === "easeCurve") {
          // EaseCurve accepts video input and outputs video
          targetHandleId = "video";
          sourceHandleIdForNewNode = "video";
        } else if (nodeType === "videoTrim") {
          // VideoTrim accepts video input and outputs video
          targetHandleId = "video";
          sourceHandleIdForNewNode = "video";
        } else if (nodeType === "videoFrameGrab") {
          // VideoFrameGrab accepts video input and outputs image
          targetHandleId = "video";
          sourceHandleIdForNewNode = "image";
        } else if (nodeType === "generateVideo") {
          // GenerateVideo outputs video
          sourceHandleIdForNewNode = "video";
        } else if (nodeType === "output") {
          // Output accepts video on its image handle (it detects video content type)
          targetHandleId = "image";
        }
      } else if (handleType === "audio") {
        if (nodeType === "audioInput") {
          // Audio node: accepts audio input and outputs audio
          targetHandleId = "audio";
          sourceHandleIdForNewNode = "audio";
        } else if (nodeType === "generateAudio") {
          // GenerateAudio outputs audio (no audio input to wire to)
          sourceHandleIdForNewNode = "audio";
        } else if (nodeType === "videoStitch") {
          // VideoStitch accepts audio
          targetHandleId = "audio";
        } else if (nodeType === "output") {
          // Output accepts audio on its audio handle
          targetHandleId = "audio";
        }
      } else if (handleType === "3d") {
        if (nodeType === "glbViewer") {
          targetHandleId = "3d";
        } else if (nodeType === "nanoBanana") {
          sourceHandleIdForNewNode = "3d";
        }
      } else if (handleType === "easeCurve") {
        if (nodeType === "easeCurve") {
          targetHandleId = "easeCurve";
          sourceHandleIdForNewNode = "easeCurve";
        }
      }

      // Get all selected nodes to connect them all to the new node
      const selectedNodes = nodes.filter((node) => node.selected);
      const sourceNode = nodes.find((node) => node.id === sourceNodeId);

      // If the source node is selected and there are multiple selected nodes,
      // connect all selected nodes to the new node
      if (sourceNode?.selected && selectedNodes.length > 1 && sourceHandleId) {
        const batchUsed = new Set<string>();

        selectedNodes.forEach((node) => {
          if (connectionType === "source" && targetHandleId) {
            // For imageCompare, alternate between image and image-1
            let resolvedTargetHandle = targetHandleId;
            if (nodeType === "imageCompare" && targetHandleId === "image" && batchUsed.has("image")) {
              resolvedTargetHandle = "image-1";
            }
            // For videoStitch, find next available video-N handle
            if (nodeType === "videoStitch" && targetHandleId.startsWith("video-")) {
              for (let i = 0; i < 50; i++) {
                const candidateHandle = `video-${i}`;
                if (!batchUsed.has(candidateHandle)) {
                  resolvedTargetHandle = candidateHandle;
                  break;
                }
              }
            }
            batchUsed.add(resolvedTargetHandle);

            // Dragging from source (output), connect selected nodes to new node's input
            const connection: Connection = {
              source: node.id,
              sourceHandle: sourceHandleId,
              target: newNodeId,
              targetHandle: resolvedTargetHandle,
            };
            if (isValidConnection(connection)) {
              onConnect(connection);
            }
          } else if (connectionType === "target" && sourceHandleIdForNewNode) {
            // Dragging from target (input), connect from new node's output to selected nodes
            const connection: Connection = {
              source: newNodeId,
              sourceHandle: sourceHandleIdForNewNode,
              target: node.id,
              targetHandle: sourceHandleId,
            };
            if (isValidConnection(connection)) {
              onConnect(connection);
            }
          }
        });
      } else {
        // Single node connection (original behavior)
        if (connectionType === "source" && sourceNodeId && sourceHandleId && targetHandleId) {
          // Dragging from source (output), connect to new node's input
          const connection: Connection = {
            source: sourceNodeId,
            sourceHandle: sourceHandleId,
            target: newNodeId,
            targetHandle: targetHandleId,
          };
          onConnect(connection);
        } else if (connectionType === "target" && sourceNodeId && sourceHandleId && sourceHandleIdForNewNode) {
          // Dragging from target (input), connect from new node's output
          const connection: Connection = {
            source: newNodeId,
            sourceHandle: sourceHandleIdForNewNode,
            target: sourceNodeId,
            targetHandle: sourceHandleId,
          };
          onConnect(connection);
        }
      }

      setConnectionDrop(null);
    },
    [connectionDrop, addNode, onConnect, nodes, handleSplitGridAction, getImageFromNode, updateNodeData]
  );

  const handleCloseDropMenu = useCallback(() => {
    setConnectionDrop(null);
  }, []);

  // Keyboard shortcuts (copy/paste, stacking, creation hotkeys, etc.)
  useCanvasKeyboard({ onShortcutsDialogOpen: () => setShortcutsDialogOpen(true) });

  // Get clipboard reference (needed by handleConnect for batch paste detection)
  const clipboard = useWorkflowStore((state) => state.clipboard);

  // Add non-passive wheel listener to handle zoom/pan and prevent browser navigation
  // This replaces the onWheel prop which is passive by default and can't preventDefault
  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    const handleWheelNonPassive = (event: WheelEvent) => {
      // Skip if modal is open
      if (isModalOpen) return;

      // Check if scrolling over a scrollable element
      const target = event.target as HTMLElement;
      const scrollableElement = findScrollableAncestor(target, event.deltaX, event.deltaY);
      if (scrollableElement) return;

      const { zoomMode } = canvasNavigationSettings;

      // Check if zoom should be triggered based on settings
      const shouldZoom =
        zoomMode === "scroll" ||
        (zoomMode === "altScroll" && event.altKey) ||
        (zoomMode === "ctrlScroll" && (event.ctrlKey || event.metaKey));

      // Pinch gesture (ctrlKey + trackpad) always zooms regardless of settings
      if (event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (event.deltaY < 0) zoomIn();
        else zoomOut();
        return;
      }

      // On macOS, differentiate trackpad from mouse
      if (isMacOS) {
        if (isMouseWheel(event)) {
          // Mouse wheel → zoom if settings allow
          if (shouldZoom) {
            event.preventDefault();
            if (event.deltaY < 0) zoomIn();
            else zoomOut();
          }
        } else {
          // Trackpad scroll
          if (shouldZoom) {
            // Zoom
            event.preventDefault();
            if (event.deltaY < 0) zoomIn();
            else zoomOut();
          } else {
            // Pan (also prevent horizontal swipe navigation)
            event.preventDefault();
            const viewport = getViewport();
            setViewport({
              x: viewport.x - event.deltaX,
              y: viewport.y - event.deltaY,
              zoom: viewport.zoom,
            });
          }
        }
        return;
      }

      // Non-macOS
      if (shouldZoom) {
        event.preventDefault();
        if (event.deltaY < 0) zoomIn();
        else zoomOut();
      }
    };

    wrapper.addEventListener('wheel', handleWheelNonPassive, { passive: false });
    return () => {
      wrapper.removeEventListener('wheel', handleWheelNonPassive);
    };
  }, [isModalOpen, zoomIn, zoomOut, getViewport, setViewport, canvasNavigationSettings]);

  // Keyboard shortcuts are handled by useCanvasKeyboard hook above


  // Fix for React Flow selection bug where nodes with undefined bounds get incorrectly selected.
  // Uses statistical outlier detection to identify and deselect nodes that are clearly
  // outside the actual selection area.
  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    if (selectedNodes.length <= 1) return;

    // Get positions of all selected nodes
    const positions = selectedNodes.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }));

    // Calculate IQR-based bounds for outlier detection
    const sortedX = [...positions].sort((a, b) => a.x - b.x);
    const sortedY = [...positions].sort((a, b) => a.y - b.y);

    const q1X = sortedX[Math.floor(sortedX.length * 0.25)].x;
    const q3X = sortedX[Math.floor(sortedX.length * 0.75)].x;
    const q1Y = sortedY[Math.floor(sortedY.length * 0.25)].y;
    const q3Y = sortedY[Math.floor(sortedY.length * 0.75)].y;
    const iqrX = q3X - q1X;
    const iqrY = q3Y - q1Y;

    // Outlier threshold: 3x IQR from quartiles
    const minX = q1X - iqrX * 3;
    const maxX = q3X + iqrX * 3;
    const minY = q1Y - iqrY * 3;
    const maxY = q3Y + iqrY * 3;

    // Find and deselect outliers
    const outliers = positions.filter(p =>
      p.x < minX || p.x > maxX || p.y < minY || p.y > maxY
    );

    if (outliers.length > 0) {
      onNodesChange(
        outliers.map(o => ({
          type: 'select' as const,
          id: o.id,
          selected: false,
        }))
      );
    }
  }, [onNodesChange]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";

    // Check if dragging a node type from the action bar
    const hasNodeType = Array.from(event.dataTransfer.types).includes("application/node-type");
    if (hasNodeType) {
      setIsDragOver(true);
      setDropType("node");
      return;
    }

    // Check if dragging a history image
    const hasHistoryImage = Array.from(event.dataTransfer.types).includes("application/history-image");
    if (hasHistoryImage) {
      setIsDragOver(true);
      setDropType("image");
      return;
    }

    // Check if dragging files that are images or JSON
    const items = Array.from(event.dataTransfer.items);
    const hasImageFile = items.some(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );
    const hasJsonFile = items.some(
      (item) => item.kind === "file" && item.type === "application/json"
    );

    const hasAudioFile = items.some(
      (item) => item.kind === "file" && item.type.startsWith("audio/")
    );

    if (hasJsonFile) {
      setIsDragOver(true);
      setDropType("workflow");
    } else if (hasAudioFile) {
      setIsDragOver(true);
      setDropType("audio");
    } else if (hasImageFile) {
      setIsDragOver(true);
      setDropType("image");
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    setDropType(null);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      setDropType(null);

      // Check for node type drop from action bar
      const nodeType = event.dataTransfer.getData("application/node-type") as NodeType;
      if (nodeType) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        addNode(nodeType, position);
        return;
      }

      // Check for history image drop
      const historyImageData = event.dataTransfer.getData("application/history-image");
      if (historyImageData) {
        try {
          const { image, prompt } = JSON.parse(historyImageData);
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });

          // Create ImageInput node with the history image
          const nodeId = addNode("imageInput", position);

          // Get image dimensions and update node
          const img = new Image();
          img.onload = () => {
            updateNodeData(nodeId, {
              image: image,
              filename: `history-${Date.now()}.png`,
              dimensions: { width: img.width, height: img.height },
            });
          };
          img.src = image;
          return;
        } catch (err) {
          console.error("Failed to parse history image data:", err);
        }
      }

      const allFiles = Array.from(event.dataTransfer.files);

      // Check for JSON workflow files first
      const jsonFiles = allFiles.filter((file) => file.type === "application/json" || file.name.endsWith(".json"));
      if (jsonFiles.length > 0) {
        const file = jsonFiles[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workflow = JSON.parse(e.target?.result as string) as WorkflowFile;
            if (workflow.version && workflow.nodes && workflow.edges) {
              await loadWorkflow(workflow);
            } else {
              alert("Invalid workflow file format");
            }
          } catch {
            alert("Failed to parse workflow file");
          }
        };
        reader.readAsText(file);
        return;
      }

      // Handle audio files
      const audioFiles = allFiles.filter((file) => file.type.startsWith("audio/"));
      if (audioFiles.length > 0) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        audioFiles.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const nodeId = addNode("audioInput", {
              x: position.x + index * 240,
              y: position.y,
            });
            updateNodeData(nodeId, {
              audioFile: dataUrl,
              filename: file.name,
              format: file.type,
            });
          };
          reader.readAsDataURL(file);
        });
        return;
      }

      // Handle image files
      const imageFiles = allFiles.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      // Get the drop position in flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Create a node for each dropped image
      imageFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;

          // Create image to get dimensions
          const img = new Image();
          img.onload = () => {
            // Add the node at the drop position (offset for multiple files)
            const nodeId = addNode("imageInput", {
              x: position.x + index * 240,
              y: position.y,
            });

            // Update the node with the image data
            updateNodeData(nodeId, {
              image: dataUrl,
              filename: file.name,
              dimensions: { width: img.width, height: img.height },
            });
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
    },
    [screenToFlowPosition, addNode, updateNodeData, loadWorkflow]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className={`flex-1 bg-canvas-bg relative ${isDragOver ? "ring-2 ring-inset ring-[var(--accent)]" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay indicator */}
      {isDragOver && (
        <div className="absolute inset-0 bg-[var(--accent)]/10 z-50 pointer-events-none flex items-center justify-center">
          <div className="bg-neutral-800 border border-neutral-600 rounded-lg px-6 py-4 shadow-xl">
            <p className="text-neutral-200 text-sm font-medium">
              {dropType === "workflow"
                ? "Drop to load workflow"
                : dropType === "node"
                ? "Drop to create node"
                : dropType === "audio"
                ? "Drop audio to create node"
                : "Drop image to create node"}
            </p>
          </div>
        </div>
      )}

      {/* Splitting indicator */}
      {isSplitting && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-neutral-800 border border-neutral-600 rounded-lg px-6 py-4 shadow-xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-neutral-200 text-sm font-medium">Splitting image grid...</p>
          </div>
        </div>
      )}

      {/* Welcome Modal */}
      {showQuickstart && (
        <WelcomeModal
          onWorkflowGenerated={async (workflow) => {
            await loadWorkflow(workflow);
            setShowQuickstart(false);
          }}
          onClose={() => setShowQuickstart(false)}
          onNewProject={() => {
            clearWorkflow();
            setShowQuickstart(false);
            setShowNewProjectSetup(true);
          }}
        />
      )}

      {/* New Project Setup Modal */}
      {showNewProjectSetup && (
        <ProjectSetupModal
          isOpen={showNewProjectSetup}
          mode="new"
          onSave={(id, name, directoryPath) => {
            setWorkflowMetadata(id, name, directoryPath);
            setShowNewProjectSetup(false);
          }}
          onClose={() => {
            setShowNewProjectSetup(false);
            setShowQuickstart(true);
          }}
        />
      )}

      <ReactFlow
        nodes={allNodes}
        edges={edgesHidden ? edges.map((e) => ({ ...e, hidden: true })) : edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectEnd={handleConnectEnd}
        onMoveStart={() => { isPanningRef.current = true; setHoveredNodeId(null); document.documentElement.classList.add("canvas-interacting"); }}
        onMoveEnd={() => { isPanningRef.current = false; document.documentElement.classList.remove("canvas-interacting"); }}
        onNodeDragStart={() => { isDraggingNodeRef.current = true; document.documentElement.classList.add("canvas-interacting"); }}
        onNodeDragStop={(event, node) => { isDraggingNodeRef.current = false; document.documentElement.classList.remove("canvas-interacting"); handleNodeDragStop(event, node); }}
        onNodeMouseEnter={(_event, node) => { if (!isPanningRef.current && !isDraggingNodeRef.current) setHoveredNodeId(node.id); }}
        onNodeMouseLeave={() => { if (!isPanningRef.current && !isDraggingNodeRef.current) setHoveredNodeId(null); }}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        fitView
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        selectionOnDrag={
          canvasNavigationSettings.selectionMode === "altDrag" || canvasNavigationSettings.selectionMode === "shiftDrag"
            ? false
            : canvasNavigationSettings.panMode === "always"
            ? false
            : isMacOS && !isModalOpen
        }
        selectionKeyCode={
          isModalOpen ? null
            : canvasNavigationSettings.selectionMode === "altDrag" ? "Alt"
            : canvasNavigationSettings.selectionMode === "shiftDrag" ? "Shift"
            : "Shift"
        }
        panOnDrag={
          isModalOpen
            ? false
            : cursorModeFromToolbar === "hand"
            ? true
            : canvasNavigationSettings.panMode === "always"
            ? true
            : canvasNavigationSettings.panMode === "middleMouse"
            ? [2]
            : !isMacOS
        }
        selectNodesOnDrag={false}
        nodeDragThreshold={5}
        nodeClickDistance={5}
        zoomOnScroll={false}
        zoomOnPinch={!isModalOpen}
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        panActivationKeyCode={
          isModalOpen
            ? null
            : canvasNavigationSettings.panMode === "space"
            ? "Space"
            : null
        }
        nodesDraggable={!isModalOpen}
        nodesConnectable={!isModalOpen}
        elementsSelectable={!isModalOpen}
        className="bg-neutral-900"
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "editable",
          animated: false,
        }}
      >
        <SharedEdgeGradients />
        <GroupBackgroundsPortal />
        <GroupControlsOverlay />
        <Background color="#404040" gap={20} size={1} />
        <InteractiveGrid />
        <CanvasToolbar nodeColor={minimapNodeColor} />
        <ViewportPortal>
          {allNodes.map((node) => {
            // Groups don't get floating headers
            if (node.type === "group") return null;

            const defaultWidth = defaultNodeDimensions[node.type as NodeType]?.width ?? 250;
            const headerWidth = node.measured?.width || (node.style?.width as number) || defaultWidth;

            // Browse button for generate nodes in inline-parameters mode
            const showBrowse = inlineParametersEnabled && (
              node.type === "nanoBanana" || node.type === "generateVideo" ||
              node.type === "generate3d" || node.type === "generateAudio"
            );
            const browseAction = showBrowse ? (
              <button
                onClick={() => browseRegistry.open(node.id)}
                className="nodrag nopan text-[10px] py-0.5 px-1.5 bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 rounded text-neutral-300 transition-colors"
              >
                Browse
              </button>
            ) : undefined;

            return (
              <FloatingNodeHeader
                key={`header-${node.id}`}
                id={node.id}
                type={node.type as NodeType}
                isInLockedGroup={!!node.data?.isInLockedGroup}
                isExecuting={!!node.data?.isExecuting}
                focusedCommentNodeId={node.data?.focusedCommentNodeId}
                position={node.position}
                width={headerWidth}
                selected={!!node.selected}
                title={getNodeTitle(node)}
                customTitle={node.data?.customTitle}
                comment={node.data?.comment}
                provider={getNodeDataProp(node.data, 'selectedModel')?.provider}
                headerAction={browseAction}
                onCustomTitleChange={handleCustomTitleChange}
                onCommentChange={handleCommentChange}
                onRunNode={handleRunNode}
                onExpandNode={handleExpandNode}
              />
            );
          })}
        </ViewportPortal>
      </ReactFlow>

      {/* Connection drop menu */}
      {connectionDrop && connectionDrop.handleType && (
        <ConnectionDropMenu
          position={connectionDrop.position}
          handleType={connectionDrop.handleType}
          connectionType={connectionDrop.connectionType}
          onSelect={handleMenuSelect}
          onClose={handleCloseDropMenu}
        />
      )}

      {/* Multi-select toolbar */}
      <MultiSelectToolbar />

      {/* Edge toolbar */}
      <EdgeToolbar />

      {/* Global image history */}
      <GlobalImageHistory />

      {/* Chat toggle button - hidden for now */}

      {/* Chat panel */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onBuildWorkflow={handleBuildWorkflow}
        isBuildingWorkflow={isBuildingWorkflow}
        onApplyEdits={handleApplyEdits}
        workflowState={chatWorkflowState}
        selectedNodeIds={selectedNodeIds}
      />

      {/* Control panel - renders on right side when a configurable node is selected */}
      <ControlPanel />

      {/* Expansion modals - rendered via portal when expand button is clicked */}
      {expandingNode && expandingNode.type === 'prompt' && (() => {
        const node = getNodeById(expandingNode.id);
        if (!node) return null;
        return createPortal(
          <PromptEditorModal
            isOpen={true}
            initialPrompt={getNodeDataProp<string>(node.data, 'prompt') || ''}
            onSubmit={(prompt) => {
              updateNodeData(expandingNode.id, { prompt });
              setExpandingNode(null);
            }}
            onClose={() => setExpandingNode(null)}
          />,
          document.body
        );
      })()}

      {expandingNode && expandingNode.type === 'promptConstructor' && (() => {
        const node = getNodeById(expandingNode.id);
        if (!node) return null;
        return createPortal(
          <PromptEditorModal
            isOpen={true}
            initialPrompt={getNodeDataProp<string>(node.data, 'template') || ''}
            onSubmit={(template) => {
              updateNodeData(expandingNode.id, { template });
              setExpandingNode(null);
            }}
            onClose={() => setExpandingNode(null)}
          />,
          document.body
        );
      })()}

      {expandingNode && expandingNode.type === 'splitGrid' && (() => {
        const node = getNodeById(expandingNode.id);
        if (!node) return null;
        return (
          <SplitGridSettingsModal
            nodeId={expandingNode.id}
            nodeData={node.data as Record<string, unknown>}
            isOpen={true}
            onOpenChange={(open) => { if (!open) setExpandingNode(null); }}
          />
        );
      })()}

      {/* AnnotationModal is globally managed by annotationStore */}
      <AnnotationModal />
    </div>
  );
}
