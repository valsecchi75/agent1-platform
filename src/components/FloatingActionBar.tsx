"use client";

import { useReactFlow } from "@xyflow/react";
import {
  ChevronUp,
  ChevronDown,
  Play,
  Square,
  Image,
  Video,
  Box,
  MessageSquare,
  ChevronsRight,
  Loader2,
  Spline,
  Waypoints,
} from "lucide-react";
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { ModelSearchDialog } from "./modals/ModelSearchDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkflowStore } from "@/store/workflowStore";
import { NodeType } from "@/types";

// All nodes menu categories
const ALL_NODES_CATEGORIES: { label: string; nodes: { type: NodeType; label: string }[] }[] = [
  {
    label: "Input",
    nodes: [
      { type: "imageInput", label: "Image Input" },
      { type: "audioInput", label: "Audio Input" },
      { type: "glbViewer", label: "3D Viewer" },
    ],
  },
  {
    label: "Text",
    nodes: [
      { type: "prompt", label: "Prompt" },
      { type: "promptConstructor", label: "Prompt Constructor" },
      { type: "array", label: "Array" },
    ],
  },
  {
    label: "Generate",
    nodes: [
      { type: "nanoBanana", label: "Generate Image" },
      { type: "generateVideo", label: "Generate Video" },
      { type: "generate3d", label: "Generate 3D" },
      { type: "generateAudio", label: "Generate Audio" },
      { type: "llmGenerate", label: "LLM Generate" },
    ],
  },
  {
    label: "Process",
    nodes: [
      { type: "annotation", label: "Annotate" },
      { type: "splitGrid", label: "Split Grid" },
      { type: "videoStitch", label: "Video Stitch" },
      { type: "videoTrim", label: "Video Trim" },
      { type: "easeCurve", label: "Ease Curve" },
      { type: "videoFrameGrab", label: "Frame Grab" },
      { type: "imageCompare", label: "Image Compare" },
    ],
  },
  {
    label: "Route",
    nodes: [
      { type: "router", label: "Router" },
      { type: "switch", label: "Switch" },
      { type: "conditionalSwitch", label: "Conditional Switch" },
    ],
  },
  {
    label: "Output",
    nodes: [
      { type: "output", label: "Output" },
      { type: "outputGallery", label: "Output Gallery" },
    ],
  },
  {
    label: "Neural Atelier",
    nodes: [
      { type: "naSketchToPhoto", label: "NA - Sketch to Photo" },
      { type: "naStylingDetail", label: "NA - Styling Detail" },
      { type: "naRecolor", label: "NA - Recolor" },
    ],
  },
  {
    label: "Utility",
    nodes: [
      { type: "previewImage", label: "Preview Image" },
      { type: "showAnything", label: "Show Anything" },
    ],
  },
  {
    label: "Morpheus",
    nodes: [
      { type: "morpheusModelManagement", label: "Model Management" },
    ],
  },
];

// Get the center of the React Flow pane in screen coordinates
function getPaneCenter() {
  const pane = document.querySelector(".react-flow");
  if (pane) {
    const rect = pane.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

interface NodeButtonProps {
  type: NodeType;
  label: string;
}

function NodeButton({ type, label }: NodeButtonProps) {
  const addNode = useWorkflowStore((state) => state.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const handleClick = () => {
    const center = getPaneCenter();
    const position = screenToFlowPosition({
      x: center.x + Math.random() * 100 - 50,
      y: center.y + Math.random() * 100 - 50,
    });
    addNode(type, position);
  };

  const handleDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData("application/node-type", type);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab active:cursor-grabbing"
    >
      {label}
    </Button>
  );
}

function GenerateComboButton() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = (type: NodeType) => {
    const center = getPaneCenter();
    const position = screenToFlowPosition({
      x: center.x + Math.random() * 100 - 50,
      y: center.y + Math.random() * 100 - 50,
    });
    addNode(type, position);
  };

  const handleDragStart = (event: React.DragEvent, type: NodeType) => {
    event.dataTransfer.setData("application/node-type", type);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          Generate
          <ChevronUp className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuItem
          onClick={() => handleAddNode("nanoBanana")}
          draggable
          onDragStart={(e) => handleDragStart(e, "nanoBanana")}
          className="cursor-grab active:cursor-grabbing"
        >
          <Image className="w-4 h-4" />
          Image
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAddNode("generateVideo")}
          draggable
          onDragStart={(e) => handleDragStart(e, "generateVideo")}
          className="cursor-grab active:cursor-grabbing"
        >
          <Video className="w-4 h-4" />
          Video
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAddNode("generate3d")}
          draggable
          onDragStart={(e) => handleDragStart(e, "generate3d")}
          className="cursor-grab active:cursor-grabbing"
        >
          <Box className="w-4 h-4" />
          3D
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAddNode("llmGenerate")}
          draggable
          onDragStart={(e) => handleDragStart(e, "llmGenerate")}
          className="cursor-grab active:cursor-grabbing"
        >
          <MessageSquare className="w-4 h-4" />
          Text (LLM)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AllNodesMenu() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = useCallback(
    (type: NodeType) => {
      const center = getPaneCenter();
      const position = screenToFlowPosition({
        x: center.x + Math.random() * 100 - 50,
        y: center.y + Math.random() * 100 - 50,
      });
      addNode(type, position);
    },
    [addNode, screenToFlowPosition]
  );

  const handleDragStart = useCallback((event: React.DragEvent, type: NodeType) => {
    event.dataTransfer.setData("application/node-type", type);
    event.dataTransfer.effectAllowed = "copy";
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          All nodes
          <ChevronUp className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="max-h-[400px] overflow-y-auto">
        {ALL_NODES_CATEGORIES.map((category, catIndex) => (
          <React.Fragment key={category.label}>
            {catIndex > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{category.label}</DropdownMenuLabel>
            {category.nodes.map((node) => (
              <DropdownMenuItem
                key={node.type}
                onClick={() => handleAddNode(node.type)}
                draggable
                onDragStart={(e) => handleDragStart(e, node.type)}
                className="cursor-grab active:cursor-grabbing"
              >
                {node.label}
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FloatingActionBar() {
  const {
    nodes,
    isRunning,
    currentNodeIds,
    executeWorkflow,
    regenerateNode,
    executeSelectedNodes,
    stopWorkflow,
    validateWorkflow,
    edgeStyle,
    setEdgeStyle,
    setModelSearchOpen,
    modelSearchOpen,
    modelSearchProvider,
  } = useWorkflowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      isRunning: state.isRunning,
      currentNodeIds: state.currentNodeIds,
      executeWorkflow: state.executeWorkflow,
      regenerateNode: state.regenerateNode,
      executeSelectedNodes: state.executeSelectedNodes,
      stopWorkflow: state.stopWorkflow,
      validateWorkflow: state.validateWorkflow,
      edgeStyle: state.edgeStyle,
      setEdgeStyle: state.setEdgeStyle,
      setModelSearchOpen: state.setModelSearchOpen,
      modelSearchOpen: state.modelSearchOpen,
      modelSearchProvider: state.modelSearchProvider,
    }))
  );

  const runningNodeCount = currentNodeIds.length;
  const getRunningLabel = () => {
    if (runningNodeCount === 0) return "Running...";
    if (runningNodeCount === 1) {
      const node = nodes.find((n) => n.id === currentNodeIds[0]);
      const nodeName = node?.data?.customTitle || node?.type || "node";
      return `Running ${nodeName}...`;
    }
    return `Running ${runningNodeCount} nodes...`;
  };

  const { valid, errors } = validateWorkflow();

  const selectedNodes = useMemo(() => {
    return nodes.filter((n) => n.selected);
  }, [nodes]);

  const selectedNode = useMemo(() => {
    return selectedNodes.length === 1 ? selectedNodes[0] : null;
  }, [selectedNodes]);

  const toggleEdgeStyle = () => {
    setEdgeStyle(edgeStyle === "angular" ? "curved" : "angular");
  };

  const handleRunClick = () => {
    if (isRunning) {
      stopWorkflow();
    } else {
      executeWorkflow();
    }
  };

  const handleRunFromSelected = () => {
    if (selectedNode) {
      executeWorkflow(selectedNode.id);
    }
  };

  const handleRunSelectedOnly = () => {
    if (selectedNode) {
      regenerateNode(selectedNode.id);
    }
  };

  const handleRunSelectedNodes = () => {
    if (selectedNodes.length > 0) {
      executeSelectedNodes(selectedNodes.map((n) => n.id));
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-0.5 bg-neutral-800/95 rounded-lg shadow-lg border border-neutral-700/80 px-1.5 py-1">
          <NodeButton type="imageInput" label="Image" />
          <NodeButton type="prompt" label="Prompt" />
          <GenerateComboButton />
          <NodeButton type="output" label="Output" />
          <AllNodesMenu />

          {/* Divider */}
          <div className="w-px h-5 bg-neutral-600 mx-1.5" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModelSearchOpen(true)}
          >
            All models
          </Button>

          <div className="w-px h-5 bg-neutral-600 mx-1.5" />

          {/* Edge style toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleEdgeStyle}>
                {edgeStyle === "angular" ? (
                  <Waypoints className="w-4 h-4" />
                ) : (
                  <Spline className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Switch to {edgeStyle === "angular" ? "curved" : "angular"} connectors
            </TooltipContent>
          </Tooltip>

          <div className="w-px h-5 bg-neutral-600 mx-1.5" />

          {/* Run controls */}
          <div className="relative flex items-center">
            <Button
              onClick={handleRunClick}
              disabled={!valid && !isRunning}
              variant="default"
              size="sm"
              className={`gap-1.5 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--accent-hover)] ${
                !isRunning && valid ? "rounded-r-none" : ""
              } ${!valid && !isRunning ? "bg-neutral-700 text-neutral-500 cursor-not-allowed hover:bg-neutral-700" : ""}`}
              title={!valid ? errors.join("\n") : isRunning ? "Stop" : "Run"}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="max-w-[150px] truncate" title={getRunningLabel()}>
                    {runningNodeCount > 1 ? `${runningNodeCount} nodes` : "Stop"}
                  </span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run</span>
                </>
              )}
            </Button>

            {/* Run options dropdown */}
            {!isRunning && valid && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center self-stretch px-1.5 rounded-r bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--accent-hover)] border-l border-[var(--accent-hover)] transition-colors">
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end">
                  <DropdownMenuItem onClick={() => executeWorkflow()}>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run entire workflow
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRunFromSelected}
                    disabled={!selectedNode}
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                    Run from selected node
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRunSelectedOnly}
                    disabled={!selectedNode}
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run selected node only
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleRunSelectedNodes}
                    disabled={selectedNodes.length === 0}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {selectedNodes.length > 0
                      ? `Run ${selectedNodes.length} selected node${selectedNodes.length !== 1 ? "s" : ""}`
                      : "Run selected nodes"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <ModelSearchDialog
          isOpen={modelSearchOpen}
          onClose={() => setModelSearchOpen(false)}
          initialProvider={modelSearchProvider}
        />
      </div>
    </TooltipProvider>
  );
}
