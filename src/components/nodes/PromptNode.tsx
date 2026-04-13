"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { HelpCircle } from "lucide-react";
import { useCallback, useState, useEffect, useMemo, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { PromptNodeData } from "@/types";

type PromptNodeType = Node<PromptNodeData, "prompt">;

// R9.5: Memoize PromptNode to prevent re-renders unless id, data, or selected changes
function PromptNodeComponent({ id, data, selected }: NodeProps<PromptNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const getConnectedInputs = useWorkflowStore((state) => state.getConnectedInputs);
  const edges = useWorkflowStore((state) => state.edges);

  // Local state for prompt to prevent cursor jumping during typing
  const [localPrompt, setLocalPrompt] = useState(nodeData.prompt);
  const [isEditing, setIsEditing] = useState(false);

  // Variable naming dialog state
  const [showVarDialog, setShowVarDialog] = useState(false);
  const [varNameInput, setVarNameInput] = useState(nodeData.variableName || "");

  // Check if this node has any incoming text connections
  const hasIncomingTextConnection = useMemo(() => {
    return edges.some((edge) => edge.target === id && edge.targetHandle === "text");
  }, [edges, id]);

  // Track the last received text from connected LLM node to detect when it changes
  const lastReceivedTextRef = useRef<string | null>(null);

  // Get connected text input and update prompt when LLM output changes
  useEffect(() => {
    if (hasIncomingTextConnection) {
      const { text } = getConnectedInputs(id);
      // Only update if the incoming text changed (LLM node ran again)
      if (text !== null && text !== lastReceivedTextRef.current) {
        lastReceivedTextRef.current = text;
        updateNodeData(id, { prompt: text });
      }
    } else {
      // Clear tracking when connection is removed
      lastReceivedTextRef.current = null;
    }
  }, [hasIncomingTextConnection, id, getConnectedInputs, updateNodeData]);

  // Sync from props when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setLocalPrompt(nodeData.prompt);
    }
  }, [nodeData.prompt, isEditing]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalPrompt(e.target.value);
    },
    []
  );

  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (localPrompt !== nodeData.prompt) {
      updateNodeData(id, { prompt: localPrompt });
    }
  }, [id, localPrompt, nodeData.prompt, updateNodeData]);

  const handleSaveVariableName = useCallback(() => {
    updateNodeData(id, { variableName: varNameInput || undefined });
    setShowVarDialog(false);
  }, [id, varNameInput, updateNodeData]);

  const handleClearVariableName = useCallback(() => {
    setVarNameInput("");
    updateNodeData(id, { variableName: undefined });
    setShowVarDialog(false);
  }, [id, updateNodeData]);

  const handleVariableNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only alphanumeric and underscore, max 30 chars
    const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);
    setVarNameInput(sanitized);
  }, []);

  return (
    <>
      <BaseNode
        id={id}
        selected={selected}
        fullBleed
      >
        {/* Text input handle - for receiving text from LLM nodes */}
        <Handle
          type="target"
          position={Position.Left}
          id="text"
          data-handletype="text"
          style={{ top: "50%", zIndex: 10 }}
        />
        <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
          style={{ right: "calc(100% + 8px)", top: "calc(50% - 7px)", color: "var(--handle-color-text)", zIndex: 10 }}>
          Text
        </div>

        <textarea
          value={localPrompt}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={hasIncomingTextConnection ? "Text from connected node (editable)..." : "Describe what to generate..."}
          className="nodrag nopan nowheel w-full h-full p-3 pb-7 text-xs leading-relaxed text-neutral-100 bg-neutral-800 rounded-t-lg resize-none focus:outline-none placeholder:text-neutral-500"
        />
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-1.5 bg-neutral-900/90 rounded-b-lg">
          <button
            onClick={() => setShowVarDialog(true)}
            className="nodrag nopan text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            title="Set variable name"
          >
            {nodeData.variableName ? `@${nodeData.variableName}` : "Add variable"}
          </button>
        </div>

        {/* Optional toggle button */}
        <button
          type="button"
          onClick={() => updateNodeData(id, { isOptional: !nodeData.isOptional })}
          className={`nodrag nopan absolute top-1 right-1 z-20 w-5 h-5 flex items-center justify-center rounded transition-colors ${
            nodeData.isOptional
              ? "text-amber-400 hover:text-amber-300"
              : "text-neutral-600 hover:text-neutral-400"
          }`}
          title={nodeData.isOptional ? "Optional: empty is allowed (click to make required)" : "Required: click to mark as optional"}
        >
          <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
        {/* Text output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="text"
          data-handletype="text"
          style={{ top: "50%", zIndex: 10 }}
        />
        <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none"
          style={{ left: "calc(100% + 8px)", top: "calc(50% - 7px)", color: "var(--handle-color-text)", zIndex: 10 }}>
          Text
        </div>
      </BaseNode>

      {/* Variable Naming Dialog - rendered via portal */}
      {showVarDialog && createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl p-4 w-96">
            <h3 className="text-sm font-semibold text-neutral-100 mb-3">Set Variable Name</h3>
            <p className="text-xs text-neutral-400 mb-3">
              Use this prompt as a variable in PromptConstructor nodes
            </p>
            <div className="mb-4">
              <label className="block text-xs text-neutral-300 mb-1">Variable name</label>
              <input
                type="text"
                value={varNameInput}
                onChange={handleVariableNameChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && varNameInput) {
                    handleSaveVariableName();
                  }
                }}
                placeholder="e.g. color, style, subject"
                className="w-full px-3 py-2 text-sm text-neutral-100 bg-neutral-900 border border-neutral-700 rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                autoFocus
              />
              {varNameInput && (
                <div className="mt-2 text-xs text-[var(--accent)]">
                  Preview: <span className="font-mono">@{varNameInput}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              {nodeData.variableName && (
                <button
                  onClick={handleClearVariableName}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setShowVarDialog(false)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVariableName}
                disabled={!varNameInput}
                className="px-3 py-1.5 text-xs font-medium text-[var(--btn-primary-text)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Export with memo, comparing data by reference (sufficient for prompt nodes)
export const PromptNode = memo(PromptNodeComponent);
