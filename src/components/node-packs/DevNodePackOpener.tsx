'use client';

import { useState, useEffect } from 'react';
import { NodePackManager } from './NodePackManager';

/**
 * Dev-only component: reads ?dev-nodepacks=<mode> from the URL and
 * automatically opens the NodePackManager dialog with mock data.
 *
 * Modes: with-packs | empty | error | new-packs
 * Example: http://localhost:3000/?dev-nodepacks=with-packs
 */
export function DevNodePackOpener() {
  const [mockMode, setMockMode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('dev-nodepacks');
    if (mode) {
      setMockMode(mode);
      setOpen(true);
    }
  }, []);

  if (!mockMode) return null;

  return <NodePackManager open={open} onOpenChange={setOpen} mockMode={mockMode} />;
}
