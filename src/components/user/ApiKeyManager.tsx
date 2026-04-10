"use client";

import { useEffect, useState } from "react";
import { Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/Toast";

const API_KEY_NAMES = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "REPLICATE_API_KEY",
  "FAL_API_KEY",
  "KIE_API_KEY",
  "WAVESPEED_API_KEY",
];

interface ApiKeyData {
  [key: string]: string;
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyData>({});
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showValue, setShowValue] = useState<{ [key: string]: boolean }>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { show: showToast } = useToast.getState();

  // Fetch keys on mount
  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      } else {
        showToast("Failed to load API keys", "error");
      }
    } catch (error) {
      showToast("Error loading API keys", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (keyName: string) => {
    setEditingKey(keyName);
    setEditValue("");
    setShowValue({});
  };

  const handleSave = async (keyName: string) => {
    if (!editValue.trim()) {
      showToast("API key value cannot be empty", "error");
      return;
    }

    try {
      setSavingKey(keyName);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyName, value: editValue }),
      });

      if (res.ok) {
        showToast("API key saved successfully", "success");
        await fetchKeys();
        setEditingKey(null);
        setEditValue("");
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Failed to save API key", "error");
      }
    } catch (error) {
      showToast("Error saving API key", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const handleDelete = async (keyName: string) => {
    if (!confirm(`Delete ${keyName}?`)) return;

    try {
      setSavingKey(keyName);
      const res = await fetch("/api/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyName }),
      });

      if (res.ok) {
        showToast(`${keyName} deleted successfully`, "success");
        await fetchKeys();
      } else {
        const errorData = await res.json();
        showToast(errorData.error || "Failed to delete API key", "error");
      }
    } catch (error) {
      showToast("Error deleting API key", "error");
    } finally {
      setSavingKey(null);
    }
  };

  const getDisplayName = (keyName: string): string => {
    return keyName.replace(/_/g, " ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
        Loading API keys...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {API_KEY_NAMES.map((keyName) => {
        const isEditing = editingKey === keyName;
        const value = keys[keyName] || "";
        const isSet = value.length > 0;
        const isSaving = savingKey === keyName;

        return (
          <div key={keyName} className="space-y-2">
            <div className="flex items-center gap-2">
              {/* Status indicator */}
              <div
                className={`w-2 h-2 rounded-full ${
                  isSet ? "bg-green-500" : "bg-neutral-600"
                }`}
              />
              <label className="text-sm font-medium text-[var(--text-primary)] flex-1">
                {getDisplayName(keyName)}
              </label>
            </div>

            {!isEditing ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                  {isSet ? value : "Not set"}
                </div>
                {isSet && (
                  <button
                    onClick={() => handleDelete(keyName)}
                    disabled={isSaving}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-colors disabled:opacity-50"
                    title="Delete API key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleStartEdit(keyName)}
                  disabled={isSaving}
                  className="px-3 py-2 text-xs bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSet ? "Update" : "Set"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type={showValue[keyName] ? "text" : "password"}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={`Enter ${getDisplayName(keyName)}`}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowValue((prev) => ({
                        ...prev,
                        [keyName]: !prev[keyName],
                      }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showValue[keyName] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => handleSave(keyName)}
                  disabled={isSaving}
                  className="px-3 py-2 text-xs bg-[var(--accent)] text-[var(--btn-primary-text)] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditingKey(null);
                    setEditValue("");
                  }}
                  disabled={isSaving}
                  className="px-3 py-2 text-xs bg-[var(--surface-3)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
