import { useCallback, useMemo } from "react";

export interface UseMediaCarouselOptions {
  items: string[]; // URLs or base64 data
  initialIndex?: number;
}

export interface UseMediaCarouselReturn {
  currentIndex: number;
  currentItem: string | null;
  totalItems: number;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Hook for managing carousel/gallery navigation.
 * Encapsulates: image/video result navigation, index tracking, and count logic.
 */
export function useMediaCarousel(
  currentIndex: number,
  onIndexChange: (index: number) => void,
  options: UseMediaCarouselOptions
): UseMediaCarouselReturn {
  const { items, initialIndex = 0 } = options;
  const totalItems = items.length;

  // Get current item
  const currentItem = useMemo(() => {
    if (totalItems === 0) return null;
    const safeIndex = Math.max(0, Math.min(currentIndex, totalItems - 1));
    return items[safeIndex] || null;
  }, [items, currentIndex, totalItems]);

  // Navigation handlers
  const next = useCallback(() => {
    if (totalItems > 0) {
      const newIndex = (currentIndex + 1) % totalItems;
      onIndexChange(newIndex);
    }
  }, [currentIndex, totalItems, onIndexChange]);

  const prev = useCallback(() => {
    if (totalItems > 0) {
      const newIndex = currentIndex === 0 ? totalItems - 1 : currentIndex - 1;
      onIndexChange(newIndex);
    }
  }, [currentIndex, totalItems, onIndexChange]);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalItems) {
        onIndexChange(index);
      }
    },
    [totalItems, onIndexChange]
  );

  const hasNext = totalItems > 0;
  const hasPrev = totalItems > 0;

  return {
    currentIndex,
    currentItem,
    totalItems,
    next,
    prev,
    goTo,
    hasNext,
    hasPrev,
  };
}
