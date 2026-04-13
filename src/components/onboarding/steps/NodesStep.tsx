"use client";

const NODE_TYPES = [
  { icon: "T", label: "Prompt", desc: "Text input for AI instructions", color: "#4a90d9" },
  { icon: "\u{1F5BC}", label: "Image Input", desc: "Load reference images", color: "#10b981" },
  { icon: "\u26A1", label: "Generate Image", desc: "AI image generation (Gemini, SDXL, Flux...)", color: "#E8530E" },
  { icon: "\u{1F4AC}", label: "LLM Generate", desc: "AI text with GPT, Gemini, Claude", color: "#8b5cf6" },
  { icon: "\u{1F3AC}", label: "Generate Video", desc: "AI video from text or image", color: "#ec4899" },
  { icon: "\u{1F4CA}", label: "Output", desc: "Display and save final results", color: "#6b7280" },
];

export function NodesStep() {
  return (
    <div className="px-10 py-6">
      <h2 className="text-lg font-light text-[var(--text-primary)] tracking-wide mb-1">Your Building Blocks</h2>
      <p className="text-xs text-[var(--text-muted)] mb-5">Nodes are the core of every workflow. Connect them to build generation pipelines.</p>
      <div className="grid grid-cols-2 gap-3">
        {NODE_TYPES.map(({ icon, label, desc, color }) => (
          <div key={label} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] transition-colors">
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: `${color}18`, color }}>{icon}</div>
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">{label}</p>
              <p className="text-[10px] text-[var(--text-muted)] font-light mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-4 text-center font-light">More node types available via the Node Pack Manager</p>
    </div>
  );
}
