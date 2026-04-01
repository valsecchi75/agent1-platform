"use client";

import { useCallback, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import type { NodeChange } from "@xyflow/react";
import { useWorkflowStore } from "@/store/workflowStore";
import type { WorkflowNode } from "@/types";
import type { NodeType } from "@/types";
import { defaultNodeDimensions } from "@/store/utils/nodeDefaults";

interface UseCanvasKeyboardOptions {
  onShortcutsDialogOpen: () => void;
}

export function useCanvasKeyboard({ onShortcutsDialogOpen }: UseCanvasKeyboardOptions) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const addNode = useWorkflowStore((state) => state.addNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const executeWorkflow = useWorkflowStore((state) => state.executeWorkflow);
  const copySelectedNodes = useWorkflowStore((state) => state.copySelectedNodes);
  const pasteNodes = useWorkflowStore((state) => state.pasteNodes);
  const clearClipboard = useWorkflowStore((state) => state.clearClipboard);
  const clipboard = useWorkflowStore((state) => state.clipboard);

  const { getViewport } = useReactFlow();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if user is typing in an input field
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Handle keyboard shortcuts dialog (? key)
    if (event.key === "?" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      onShortcutsDialogOpen();
      return;
    }

    // Handle workflow execution (Ctrl/Cmd + Enter)
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      executeWorkflow();
      return;
    }

    // Handle copy (Ctrl/Cmd + C)
    if ((event.ctrlKey || event.metaKey) && event.key === "c") {
      event.preventDefault();
      copySelectedNodes();
      return;
    }

    // Helper to get viewport center position in flow coordinates
    const getViewportCenter = () => {
      const viewport = getViewport();
      const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
      const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
      return { centerX, centerY };
    };

    // Handle node creation hotkeys (Shift + key)
    if (event.shiftKey && !event.ctrlKey && !event.metaKey) {
      const key = event.key.toLowerCase();
      let nodeType: NodeType | null = null;

      switch (key) {
        case "p": nodeType = "prompt"; break;
        case "r": nodeType = "router"; break;
        case "i": nodeType = "imageInput"; break;
        case "g": nodeType = "nanoBanana"; break;
        case "v": nodeType = "generateVideo"; break;
        case "l": nodeType = "llmGenerate"; break;
        case "a": nodeType = "annotation"; break;
        case "t": nodeType = "generateAudio"; break;
      }

      if (nodeType) {
        event.preventDefault();
        const { centerX, centerY } = getViewportCenter();
        const dims = defaultNodeDimensions[nodeType];
        addNode(nodeType, { x: centerX - dims.width / 2, y: centerY - dims.height / 2 });
        return;
      }
    }

    // Handle paste (Ctrl/Cmd + V)
    if ((event.ctrlKey || event.metaKey) && event.key === "v") {
      event.preventDefault();

      // If we have nodes in the internal clipboard, prioritize pasting those
      if (clipboard && clipboard.nodes.length > 0) {
        pasteNodes();
        clearClipboard();
        return;
      }

      // Check system clipboard for images first, then text
      navigator.clipboard.read().then(async (items) => {
        for (const item of items) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              const img = new Image();
              img.onload = () => {
                const selectedImageInputNode = nodes.find(
                  (node) => node.selected && node.type === "imageInput"
                );

                if (selectedImageInputNode) {
                  updateNodeData(selectedImageInputNode.id, {
                    image: dataUrl,
                    imageRef: undefined,
                    filename: `pasted-${Date.now()}.png`,
                    dimensions: { width: img.width, height: img.height },
                  });
                } else {
                  const viewport = getViewport();
                  const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
                  const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
                  const nodeId = addNode("imageInput", { x: centerX - 150, y: centerY - 140 });
                  updateNodeData(nodeId, {
                    image: dataUrl,
                    filename: `pasted-${Date.now()}.png`,
                    dimensions: { width: img.width, height: img.height },
                  });
                }
              };
              img.src = dataUrl;
            };
            reader.readAsDataURL(blob);
            return;
          }

          if (item.types.includes('text/plain')) {
            const blob = await item.getType('text/plain');
            const text = await blob.text();
            if (text.trim()) {
              const viewport = getViewport();
              const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
              const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
              const nodeId = addNode("prompt", { x: centerX - 160, y: centerY - 110 });
              updateNodeData(nodeId, { prompt: text });
              return;
            }
          }
        }
      }).catch(() => {
        // Clipboard API failed - nothing to paste
      });
      return;
    }

    // Layout shortcuts require 2+ selected nodes
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length < 2) return;

    const STACK_GAP = 20;

    if (event.key === "v" || event.key === "V") {
      // Stack vertically
      const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
      const alignX = Math.min(...sortedNodes.map((n) => n.position.x));
      let currentY = sortedNodes[0].position.y;

      sortedNodes.forEach((node) => {
        const nodeHeight = (node.style?.height as number) || (node.measured?.height) || 200;
        onNodesChange([{
          type: "position",
          id: node.id,
          position: { x: alignX, y: currentY },
        }]);
        currentY += nodeHeight + STACK_GAP;
      });
    } else if (event.key === "h" || event.key === "H") {
      // Stack horizontally
      const sortedNodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
      const alignY = Math.min(...sortedNodes.map((n) => n.position.y));
      let currentX = sortedNodes[0].position.x;

      sortedNodes.forEach((node) => {
        const nodeWidth = (node.style?.width as number) || (node.measured?.width) || 220;
        onNodesChange([{
          type: "position",
          id: node.id,
          position: { x: currentX, y: alignY },
        }]);
        currentX += nodeWidth + STACK_GAP;
      });
    } else if (event.key === "g" || event.key === "G") {
      // Arrange as grid
      const count = selectedNodes.length;
      const cols = Math.ceil(Math.sqrt(count));
      const sortedNodes = [...selectedNodes].sort((a, b) => {
        const rowA = Math.floor(a.position.y / 100);
        const rowB = Math.floor(b.position.y / 100);
        if (rowA !== rowB) return rowA - rowB;
        return a.position.x - b.position.x;
      });

      const startX = Math.min(...sortedNodes.map((n) => n.position.x));
      const startY = Math.min(...sortedNodes.map((n) => n.position.y));
      const maxWidth = Math.max(
        ...sortedNodes.map((n) => (n.style?.width as number) || (n.measured?.width) || 220)
      );
      const maxHeight = Math.max(
        ...sortedNodes.map((n) => (n.style?.height as number) || (n.measured?.height) || 200)
      );

      sortedNodes.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        onNodesChange([{
          type: "position",
          id: node.id,
          position: {
            x: startX + col * (maxWidth + STACK_GAP),
            y: startY + row * (maxHeight + STACK_GAP),
          },
        }]);
      });
    }
  }, [nodes, onNodesChange, copySelectedNodes, pasteNodes, clearClipboard, clipboard, getViewport, addNode, updateNodeData, executeWorkflow, onShortcutsDialogOpen]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
