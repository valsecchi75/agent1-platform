"use client";

import { Edit3, Check, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface KeyState {
  masked: string;
  editing: boolean;
  newValue: string;
  saving: boolean;
}

const KEY_LABELS: Record<string, string> = {
  GEMINI_API_KEY: "Google Gemini",
  OPENAI_API_KEY: "OpenAI",
  ANTHROPIC_API_KEY: "Anthropic",
  REPLICATE_API_KEY: "Replicate",
  FAL_API_KEY: "fal.ai",
  KIE_API_KEY: "Kie.ai",
  WAVESPEED_API_KEY: "WaveSpeed",
};

interface ApiKeyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiKeyPanel({ isOpen, onClose }: ApiKeyPanelProps) {
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const initialState: Record<string, KeyState> = {};
        for (const [key, masked] of Object.entries(data)) {
          initialState[key] = {
            masked: masked as string,
            editing: false,
            newValue: "",
            saving: false,
          };
        }
        setKeys(initialState);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen]);

  const handleSave = async (key: string) => {
    const state = keys[key];
    if (!state || !state.newValue.trim()) return;

    setKeys((prev) => ({
      ...prev,
      [key]: { ...prev[key], saving: true },
    }));

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: state.newValue.trim() }),
      });

      if (res.ok) {
        const refreshRes = await fetch("/api/settings");
        const data = await refreshRes.json();
        setKeys((prev) => ({
          ...prev,
          [key]: {
            masked: data[key],
            editing: false,
            newValue: "",
            saving: false,
          },
        }));
      }
    } catch {
      setKeys((prev) => ({
        ...prev,
        [key]: { ...prev[key], saving: false },
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>API Keys</DialogTitle>
          <DialogDescription>
            Keys are stored in .env and never sent to the browser unmasked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : (
            Object.entries(KEY_LABELS).map(([key, label]) => {
              const state = keys[key];
              if (!state) return null;
              const isConfigured = state.masked !== "not configured";

              return (
                <div key={key} className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-subtle)]">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isConfigured ? "bg-green-500" : "bg-neutral-600"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
                      {isConfigured && (
                        <Badge variant="success" className="text-[9px] px-1.5 py-0">
                          Active
                        </Badge>
                      )}
                    </div>
                    {state.editing ? (
                      <div className="flex gap-2 mt-1.5">
                        <Input
                          type="password"
                          value={state.newValue}
                          onChange={(e) =>
                            setKeys((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], newValue: e.target.value },
                            }))
                          }
                          placeholder="Paste API key"
                          autoFocus
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSave(key)}
                          disabled={state.saving || !state.newValue.trim()}
                        >
                          {state.saving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setKeys((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], editing: false, newValue: "" },
                            }))
                          }
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text-muted)] font-mono">{state.masked}</div>
                    )}
                  </div>
                  {!state.editing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setKeys((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], editing: true },
                        }))
                      }
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
