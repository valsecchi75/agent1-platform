import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePromptAutocomplete } from "@/hooks/usePromptAutocomplete";
import { AvailableVariable } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleAttemptClose();
      }}>
        <DialogContent size="lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>Edit Prompt Constructor</DialogTitle>
              {unresolvedVars.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-900/30 border border-amber-700/50 rounded text-[11px] text-amber-400">
                  Unresolved: {unresolvedVars.map((v) => `@${v}`).join(", ")}
                </span>
              )}
            </div>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4 p-0">
            {/* Box containing toolbar and textarea */}
            <div className="flex-1 flex flex-col border border-[var(--border)] rounded bg-[var(--surface-1)]/30 overflow-hidden mx-6">
              {/* Toolbar */}
              <div className="min-h-[48px] bg-[var(--surface-1)] border-b border-[var(--border)] flex items-center px-4 gap-3 shrink-0 flex-wrap py-2">
                {/* Font Size Control */}
                <select
                  value={fontSize}
                  onChange={handleFontSizeChange}
                  className="text-sm py-1 px-2 border border-[var(--border)] rounded bg-[var(--surface-1)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] text-[var(--text-secondary)]"
                >
                  {FONT_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>

                {/* Divider */}
                {availableVariables.length > 0 && (
                  <div className="w-px h-5 bg-[var(--border)]" />
                )}

                {/* Variable pills */}
                {availableVariables.map((v) => (
                  <button
                    key={v.nodeId}
                    onClick={() => handleVariablePillClick(v.name)}
                    className="px-2 py-0.5 text-[11px] text-[var(--accent)] bg-[var(--accent-subtle)] border border-[var(--accent)]/30 rounded hover:bg-[var(--accent-subtle)] transition-colors"
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
                  className="nodrag nopan nowheel flex-1 w-full p-6 leading-relaxed text-[var(--text-primary)] bg-transparent border-0 resize-none focus:outline-none placeholder:text-[var(--text-muted)]"
                  style={{ fontSize: `${fontSize}px` }}
                  autoFocus
                />

                {/* Autocomplete dropdown */}
                {showAutocomplete && filteredAutocompleteVars.length > 0 && (
                  <div
                    className="absolute z-10 bg-[var(--surface-2)] border border-[var(--border)] rounded shadow-xl max-h-40 overflow-y-auto"
                    style={{
                      top: autocompletePosition.top + 16,
                      left: autocompletePosition.left + 24,
                    }}
                  >
                    {filteredAutocompleteVars.map((variable, index) => (
                      <button
                        key={variable.nodeId}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAutocompleteSelect(variable.name);
                        }}
                        className={`w-full px-3 py-2 text-left text-[11px] flex flex-col gap-0.5 transition-colors ${
                          index === selectedAutocompleteIndex
                            ? "bg-[var(--surface-3)] text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                        }`}
                      >
                        <div className="font-medium text-[var(--accent)]">@{variable.name}</div>
                        <div className="text-[var(--text-muted)] truncate max-w-[200px]">
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
              <div className="mx-6 border border-[var(--border)] rounded bg-[var(--surface-1)]/30 overflow-hidden">
                <div className="px-4 py-2 bg-[var(--surface-1)] border-b border-[var(--border)] text-[11px] text-[var(--text-secondary)] uppercase tracking-wide font-semibold">
                  Resolved Preview
                </div>
                <div className="p-4 text-sm text-[var(--text-secondary)] whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                  {resolvedPreview || <span className="text-[var(--text-muted)] italic">Empty template</span>}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <DialogButton variant="ghost" onClick={handleAttemptClose}>
              Cancel
            </DialogButton>
            <DialogButton variant="primary" onClick={handleSubmit}>
              Submit
            </DialogButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={(open) => {
        if (!open) handleDismissConfirmation();
      }}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>

          <DialogBody className="text-center">
            <p className="text-[var(--text-primary)]">
              You have unsaved changes
            </p>
          </DialogBody>

          <DialogFooter>
            <DialogButton variant="ghost" onClick={onClose}>
              Discard
            </DialogButton>
            <DialogButton variant="primary" onClick={handleSubmit}>
              Submit
            </DialogButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
