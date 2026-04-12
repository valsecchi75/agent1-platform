import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePromptAutocomplete } from "@/hooks/usePromptAutocomplete";
import { AvailableVariable } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogButton,
} from "@/components/ui/dialog";

const FONT_SIZE_STORAGE_KEY = "prompt-constructor-editor-font-size";
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;
const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24];

interface PromptConstructorEditorModalProps {
  isOpen: boolean;
  initialTemplate: string;
  availableVariables: AvailableVariable[];
  onSubmit: (template: string) => void;
  onClose: () => void;
}

export const PromptConstructorEditorModal: React.FC<PromptConstructorEditorModalProps> = ({
  isOpen,
  initialTemplate,
  availableVariables,
  onSubmit,
  onClose,
}) => {
  const [template, setTemplate] = useState(initialTemplate);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_FONT_SIZE && parsed <= MAX_FONT_SIZE) {
          return parsed;
        }
      }
    }
    return DEFAULT_FONT_SIZE;
  });

  useEffect(() => {
    setTemplate(initialTemplate);
  }, [initialTemplate]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize.toString());
    }
  }, [fontSize]);

  const hasUnsavedChanges = template !== initialTemplate;

  const {
    showAutocomplete,
    autocompletePosition,
    filteredAutocompleteVars,
    selectedAutocompleteIndex,
    handleChange: autocompleteHandleChange,
    handleKeyDown: autocompleteHandleKeyDown,
    handleAutocompleteSelect,
    closeAutocomplete,
  } = usePromptAutocomplete({
    availableVariables,
    textareaRef,
    localTemplate: template,
    setLocalTemplate: setTemplate,
  });

  // Unresolved variables
  const unresolvedVars = useMemo(() => {
    const varPattern = /@(\w+)/g;
    const unresolved: string[] = [];
    const matches = template.matchAll(varPattern);
    const availableNames = new Set(availableVariables.map((v) => v.name));

    for (const match of matches) {
      const varName = match[1];
      if (!availableNames.has(varName) && !unresolved.includes(varName)) {
        unresolved.push(varName);
      }
    }
    return unresolved;
  }, [template, availableVariables]);

  // Resolved preview
  const resolvedPreview = useMemo(() => {
    let resolved = template;
    availableVariables.forEach((v) => {
      resolved = resolved.replace(new RegExp(`@${v.name}`, "g"), v.value);
    });
    return resolved;
  }, [template, availableVariables]);

  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowConfirmation(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Escape key: close autocomplete first, then modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAutocomplete) {
          closeAutocomplete();
        } else {
          handleAttemptClose();
        }
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleAttemptClose, showAutocomplete, closeAutocomplete]);

  const handleSubmit = useCallback(() => {
    onSubmit(template);
    onClose();
  }, [template, onSubmit, onClose]);

  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFontSize(parseInt(e.target.value, 10));
  }, []);

  const handleDismissConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  // Insert @varName at cursor when clicking a variable pill
  const handleVariablePillClick = useCallback(
    (varName: string) => {
      if (!textareaRef.current) return;
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const insertion = `@${varName}`;
      const newTemplate = template.slice(0, start) + insertion + template.slice(end);
      setTemplate(newTemplate);

      const newCursorPos = start + insertion.length;
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [template]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) handleAttemptClose();
    },
    [handleAttemptClose]
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="h-[85vh]" hideClose>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Edit Prompt Constructor</DialogTitle>
            {unresolvedVars.length > 0 && (
              <span
                className="px-2 py-0.5 rounded text-[11px]"
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  color: "rgb(245, 158, 11)",
                }}
              >
                Unresolved: {unresolvedVars.map((v) => `@${v}`).join(", ")}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Box containing toolbar and textarea */}
        <div
          className="mx-6 flex-1 flex flex-col rounded overflow-hidden min-h-0"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}
        >
          {/* Toolbar */}
          <div
            className="min-h-[48px] flex items-center px-4 gap-3 shrink-0 flex-wrap py-2"
            style={{
              background: "var(--surface-3)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <select
              value={fontSize}
              onChange={handleFontSizeChange}
              className="text-sm py-1 px-2 rounded focus:outline-none focus:ring-1"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-secondary)",
              }}
            >
              {FONT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>

            {/* Divider */}
            {availableVariables.length > 0 && (
              <div className="w-px h-5" style={{ background: "var(--border)" }} />
            )}

            {/* Variable pills */}
            {availableVariables.map((v) => (
              <button
                key={v.nodeId}
                onClick={() => handleVariablePillClick(v.name)}
                className="px-2 py-0.5 text-[11px] rounded transition-colors"
                style={{
                  color: "var(--accent)",
                  background: "var(--accent-subtle)",
                  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
                title={v.value || "(empty)"}
              >
                @{v.name}
              </button>
            ))}
          </div>

          {/* Textarea with autocomplete */}
          <div className="relative flex-1 flex flex-col">
            <textarea
              ref={textareaRef}
              value={template}
              onChange={autocompleteHandleChange}
              onKeyDown={autocompleteHandleKeyDown}
              placeholder="Type @ to insert variables..."
              className="nodrag nopan nowheel flex-1 w-full p-6 leading-relaxed bg-transparent border-0 resize-none focus:outline-none"
              style={{
                fontSize: `${fontSize}px`,
                color: "var(--text-primary)",
              }}
              autoFocus
            />

            {/* Autocomplete dropdown */}
            {showAutocomplete && filteredAutocompleteVars.length > 0 && (
              <div
                className="absolute z-10 rounded shadow-xl max-h-40 overflow-y-auto"
                style={{
                  top: autocompletePosition.top + 16,
                  left: autocompletePosition.left + 24,
                  background: "var(--modal-bg)",
                  border: "1px solid var(--border)",
                }}
              >
                {filteredAutocompleteVars.map((variable, index) => (
                  <button
                    key={variable.nodeId}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAutocompleteSelect(variable.name);
                    }}
                    className="w-full px-3 py-2 text-left text-[11px] flex flex-col gap-0.5 transition-colors"
                    style={{
                      background: index === selectedAutocompleteIndex ? "var(--surface-3)" : "transparent",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div className="font-medium" style={{ color: "var(--accent)" }}>@{variable.name}</div>
                    <div className="truncate max-w-[200px]" style={{ color: "var(--text-muted)" }}>
                      {variable.value || "(empty)"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resolved preview */}
        {availableVariables.length > 0 && (
          <div
            className="mx-6 rounded overflow-hidden"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            <div
              className="px-4 py-2 text-[11px] uppercase tracking-wide font-semibold"
              style={{
                background: "var(--surface-3)",
                borderBottom: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Resolved Preview
            </div>
            <div
              className="p-4 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {resolvedPreview || (
                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Empty template</span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogButton variant="secondary" onClick={handleAttemptClose}>
            Cancel
          </DialogButton>
          <DialogButton variant="primary" onClick={handleSubmit}>
            Submit
          </DialogButton>
        </DialogFooter>

        {/* Confirmation overlay */}
        {showConfirmation && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleDismissConfirmation();
            }}
          >
            <div
              className="relative rounded-lg p-6 mx-4 max-w-sm shadow-xl"
              style={{
                background: "var(--modal-bg)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                onClick={handleDismissConfirmation}
                className="absolute top-3 right-3 transition-colors focus:outline-none"
                style={{ color: "var(--text-muted)" }}
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <p className="text-center mb-6" style={{ color: "var(--text-primary)" }}>
                You have unsaved changes
              </p>
              <div className="flex justify-center gap-3">
                <DialogButton variant="secondary" onClick={onClose}>
                  Discard
                </DialogButton>
                <DialogButton variant="primary" onClick={handleSubmit}>
                  Submit
                </DialogButton>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
