import { useSyncExternalStore, useCallback, useEffect } from "react";

const HANDLE_LABELS_KEY = "agent1-handle-labels";

const subscribers = new Set<() => void>();

function getSnapshot(): boolean {
  try {
    const val = localStorage.getItem(HANDLE_LABELS_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

function getServerSnapshot(): boolean {
  return true;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notifySubscribers() {
  subscribers.forEach((callback) => callback());
}

/**
 * Hook to control visibility of handle labels on nodes.
 * Persisted in localStorage. Default: visible (true).
 *
 * When labels are hidden, adds `.handle-labels-hidden` to <html>
 * so CSS can hide all label divs globally (including existing nodes).
 */
export function useHandleLabels() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Sync CSS class on <html> for global label visibility
  useEffect(() => {
    if (visible) {
      document.documentElement.classList.remove("handle-labels-hidden");
    } else {
      document.documentElement.classList.add("handle-labels-hidden");
    }
  }, [visible]);

  const setHandleLabels = useCallback((value: boolean) => {
    try {
      localStorage.setItem(HANDLE_LABELS_KEY, String(value));
    } catch {
      // localStorage not available
    }
    notifySubscribers();
  }, []);

  return { handleLabelsVisible: visible, setHandleLabels };
}
