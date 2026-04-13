import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogButton,
} from "@/components/ui/dialog";

const FONT_SIZE_STORAGE_KEY = "prompt-editor-font-size";
const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 24;
const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24];

interface PromptEditorModalProps {
  isOpen: boolean;
  initialPrompt: string;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

export const PromptEditorModal: React.FC<PromptEditorModalProps> = ({
  isOpen,
  initialPrompt,
  onSubmit,
  onClose,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize.toString());
    }
  }, [fontSize]);

  const hasUnsavedChanges = prompt !== initialPrompt;

  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowConfirmation(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleSubmit = useCallback(() => {
    onSubmit(prompt);
    onClose();
  }, [prompt, onSubmit, onClose]);

  const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFontSize(parseInt(e.target.value, 10));
  }, []);

  const handleDismissConfirmation = useCallback(() => {
    setShowConfirmation(false);
  }, []);

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
          <DialogTitle>Edit Prompt</DialogTitle>
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
            className="h-12 flex items-center px-4 gap-3 shrink-0"
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
          </div>

          {/* Textarea */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what to generate..."
            className="nodrag nopan nowheel flex-1 w-full p-6 leading-relaxed bg-transparent border-0 resize-none focus:outline-none"
            style={{
              fontSize: `${fontSize}px`,
              color: "var(--text-primary)",
            }}
            autoFocus
          />
        </div>

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
