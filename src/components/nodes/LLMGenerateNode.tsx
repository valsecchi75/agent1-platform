"use client";

import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { Loader2, AlertTriangle, Copy, Check, RefreshCw, X } from "lucide-react";
import { useCallback, useState } from "react";
import { BaseNode } from "./BaseNode";
import { InlineParameterPanel } from "./InlineParameterPanel";
import { useInlineParameters } from "@/hooks/useInlineParameters";
import { useWorkflowStore } from "@/store/workflowStore";
import { LLMGenerateNodeData, LLMProvider, LLMModelType } from "@/types";

// LLM providers and models
const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

const LLM_MODELS: Record<LLMProvider, { value: LLMModelType; label: string }[]> = {
  google: [
    { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { value: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash-Lite" },
  ],
  openai: [
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  ],
  anthropic: [
    { value: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
    { value: "claude-opus-4.6", label: "Claude Opus 4.6" },
  ],
};

type LLMGenerateNodeType = Node<LLMGenerateNodeData, "llmGenerate">;

export function LLMGenerateNode({ id, data, selected }: NodeProps<LLMGenerateNodeType>) {
  const nodeData = data;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const regenerateNode = useWorkflowStore((state) => state.regenerateNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);

  // Inline parameters infrastructure
  const { inlineParametersEnabled } = useInlineParameters();

  const handleRegenerate = useCallback(() => {
    regenerateNode(id);
  }, [id, regenerateNode]);

  const handleClearOutput = useCallback(() => {
    updateNodeData(id, { outputText: null, status: "idle", error: null });
  }, [id, updateNodeData]);

  const [copied, setCopied] = useState(false);

  const handleCopyOutput = useCallback(async () => {
    if (nodeData.outputText) {
      try {
        await navigator.clipboard.writeText(nodeData.outputText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error("Failed to copy text:", err);
      }
    }
  }, [nodeData.outputText]);

  // Inline parameters: compute collapse state and toggle handler
  const isParamsExpanded = nodeData.parametersExpanded ?? true; // default expanded

  const handleToggleParams = useCallback(() => {
    updateNodeData(id, { parametersExpanded: !isParamsExpanded });
  }, [id, isParamsExpanded, updateNodeData]);

  // LLM parameter handlers
  const handleProviderChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newProvider = e.target.value as LLMProvider;
      const firstModelForProvider = LLM_MODELS[newProvider][0].value;
      const updates: Partial<LLMGenerateNodeData> = {
        provider: newProvider,
        model: firstModelForProvider,
      };
      if (newProvider === "anthropic" && (nodeData.temperature ?? 0.7) > 1) {
        updates.temperature = 1;
      }
      updateNodeData(id, updates);
    },
    [id, nodeData.temperature, updateNodeData]
  );

  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateNodeData(id, { model: e.target.value as LLMModelType });
    },
    [id, updateNodeData]
  );

  const handleTemperatureChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { temperature: parseFloat(e.target.value) });
    },
    [id, updateNodeData]
  );

  const handleMaxTokensChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateNodeData(id, { maxTokens: parseInt(e.target.value, 10) });
    },
    [id, updateNodeData]
  );

  const provider = nodeData.provider || "google";
  const availableModels = LLM_MODELS[provider] || LLM_MODELS.google;

  return (
    <BaseNode
      id={id}
      selected={selected}
      hasError={nodeData.status === "error"}
      isExecuting={isRunning}
      fullBleed
      settingsExpanded={inlineParametersEnabled && isParamsExpanded}
      settingsPanel={inlineParametersEnabled ? (
        <InlineParameterPanel
          expanded={isParamsExpanded}
          onToggle={handleToggleParams}
          nodeId={id}
        >
          {/* LLM-specific controls */}
          <div className="space-y-1.5 max-w-[280px]">
            {/* Provider */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-neutral-400 shrink-0">Provider</label>
              <select
                value={provider}
                onChange={handleProviderChange}
                className="nodrag nopan flex-1 min-w-0 text-[11px] py-1 px-2 bg-[#1a1a1a] rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-600 text-neutral-50"
              >
                {LLM_PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-neutral-400 shrink-0">Model</label>
              <select
                value={nodeData.model || availableModels[0].value}
                onChange={handleModelChange}
                className="nodrag nopan flex-1 min-w-0 text-[11px] py-1 px-2 bg-[#1a1a1a] rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-600 text-white"
              >
                {availableModels.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[11px] text-neutral-400">
                Temperature: {(nodeData.temperature ?? 0.7).toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max={provider === "anthropic" ? "1" : "2"}
                step="0.01"
                value={nodeData.temperature ?? 0.7}
                onChange={handleTemperatureChange}
                className="nodrag nopan w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Max Tokens */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[11px] text-neutral-400">
                Max Tokens: {(nodeData.maxTokens || 2048).toLocaleString()}
              </label>
              <input
                type="range"
                min="256"
                max="16384"
                step="256"
                value={nodeData.maxTokens || 2048}
                onChange={handleMaxTokensChange}
                className="nodrag nopan w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>
        </InlineParameterPanel>
      ) : undefined}
    >
      {/* Image input - optional */}
      <Handle
        type="target"
        position={Position.Left}
        id="image"
        style={{ top: "35%", zIndex: 10 }}
        data-handletype="image"
      />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(35% - 7px)", color: "var(--handle-color-image)", zIndex: 10 }}>
        Image
      </div>
      {/* Text input */}
      <Handle
        type="target"
        position={Position.Left}
        id="text"
        style={{ top: "65%", zIndex: 10 }}
        data-handletype="text"
      />
      <div className="handle-label absolute text-[10px] font-medium whitespace-nowrap pointer-events-none text-right"
        style={{ right: "calc(100% + 8px)", top: "calc(65% - 7px)", color: "var(--handle-color-text)", zIndex: 10 }}>
        Prompt
      </div>
      {/* Text output */}
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

      <div className="relative w-full h-full min-h-0 overflow-hidden rounded-lg">
        {nodeData.status === "loading" ? (
          <div className="w-full h-full bg-neutral-900/40 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
          </div>
        ) : nodeData.status === "error" ? (
          <div className="w-full h-full bg-red-900/40 flex flex-col items-center justify-center gap-1">
            <AlertTriangle className="w-6 h-6 text-white" />
            <span className="text-white text-xs font-medium">Generation failed</span>
            {nodeData.error && (
              <span className="text-red-200 text-[10px] text-center px-3 mt-1 line-clamp-3">{nodeData.error}</span>
            )}
          </div>
        ) : nodeData.outputText ? (
          <div className="group/text relative w-full h-full bg-neutral-900/40 p-2 overflow-auto nowheel">
            <p className="text-[10px] text-neutral-300 whitespace-pre-wrap break-words">
              {nodeData.outputText}
            </p>
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/text:opacity-100 transition-opacity">
              <button
                onClick={handleCopyOutput}
                className={`nodrag nopan w-5 h-5 ${copied ? "bg-green-600/80" : "bg-neutral-900/80 hover:bg-neutral-700/80"} rounded flex items-center justify-center text-neutral-400 hover:text-neutral-50 transition-colors`}
                title={copied ? "Copied!" : "Copy to clipboard"}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isRunning}
                className="nodrag nopan w-5 h-5 bg-neutral-900/80 hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-neutral-400 hover:text-neutral-50 transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={handleClearOutput}
                className="nodrag nopan w-5 h-5 bg-neutral-900/80 hover:bg-red-600/80 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-50 transition-colors"
                title="Clear output"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-neutral-900/40 flex items-center justify-center">
            <span className="text-neutral-500 text-[10px]">
              Run to generate
            </span>
          </div>
        )}
      </div>

    </BaseNode>
  );
}
