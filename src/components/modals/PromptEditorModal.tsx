import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogButton,
} from '@/components/ui/dialog';

const FONT_SIZE_STORAGE_KEY = 'prompt-editor-font-size';
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
    // Load font size from localStorage on mount
    if (typeof window !== 'undefined') {
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

  // Update local state when initial prompt changes
  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  // Save font size to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize.toString());
    }
  }, [fontSize]);

  // Track unsaved changes
  const hasUnsavedChanges = prompt !== initialPrompt;

  // Handle close attempt - show confirmation if there are unsaved changes
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) handleAttemptClose();
      }}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit Prompt</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4 p-0">
            {/* Box containing toolbar and textarea */}
            <div className="flex-1 flex flex-col border border-[var(--border)] rounded bg-[var(--surface-1)]/30 overflow-hidden mx-6">
              {/* Toolbar - header of the box */}
              <div className="h-12 bg-[var(--surface-1)] border-b border-[var(--border)] flex items-center px-4 gap-3 shrink-0">
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
              </div>

              {/* Textarea */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what to generate..."
                className="nodrag nopan nowheel flex-1 w-full p-6 leading-relaxed text-[var(--text-primary)] bg-transparent border-0 resize-none focus:outline-none placeholder:text-[var(--text-muted)]"
                style={{ fontSize: `${fontSize}px` }}
                autoFocus
              />
            </div>
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
