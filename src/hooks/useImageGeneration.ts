import { useCallback, useState, useRef, useEffect } from "react";
import { useWorkflowStore } from "@/store/workflowStore";

/**
 * Hook encapsulating image generation API logic and state management.
 * Abstracts generation calls, loading states, error handling, and result processing.
 */
export function useImageGeneration(nodeId: string) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const generationsPath = useWorkflowStore((state) => state.generationsPath);
  const [isLoadingCarouselImage, setIsLoadingCarouselImage] = useState(false);

  /**
   * Load image by ID from the generations folder
   */
  const loadImageById = useCallback(
    async (imageId: string) => {
      if (!generationsPath) {
        console.error("Generations path not configured");
        return null;
      }

      try {
        const response = await fetch("/api/load-generation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directoryPath: generationsPath,
            imageId,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          console.log(`Image not found: ${imageId}`);
          return null;
        }
        return result.image;
      } catch (error) {
        console.warn("Error loading image:", error);
        return null;
      }
    },
    [generationsPath]
  );

  /**
   * Navigate to previous image in carousel history
   */
  const handleCarouselPrevious = useCallback(
    async (
      imageHistory: Array<{ id: string }> | undefined,
      selectedHistoryIndex: number | undefined
    ) => {
      const history = imageHistory || [];
      if (history.length === 0 || isLoadingCarouselImage) return;

      const currentIndex = selectedHistoryIndex || 0;
      const newIndex = currentIndex === 0 ? history.length - 1 : currentIndex - 1;
      const imageItem = history[newIndex];

      setIsLoadingCarouselImage(true);
      const image = await loadImageById(imageItem.id);
      setIsLoadingCarouselImage(false);

      if (image) {
        updateNodeData(nodeId, {
          outputImage: image,
          selectedHistoryIndex: newIndex,
        });
      }
    },
    [nodeId, isLoadingCarouselImage, loadImageById, updateNodeData]
  );

  /**
   * Navigate to next image in carousel history
   */
  const handleCarouselNext = useCallback(
    async (
      imageHistory: Array<{ id: string }> | undefined,
      selectedHistoryIndex: number | undefined
    ) => {
      const history = imageHistory || [];
      if (history.length === 0 || isLoadingCarouselImage) return;

      const currentIndex = selectedHistoryIndex || 0;
      const newIndex = (currentIndex + 1) % history.length;
      const imageItem = history[newIndex];

      setIsLoadingCarouselImage(true);
      const image = await loadImageById(imageItem.id);
      setIsLoadingCarouselImage(false);

      if (image) {
        updateNodeData(nodeId, {
          outputImage: image,
          selectedHistoryIndex: newIndex,
        });
      }
    },
    [nodeId, isLoadingCarouselImage, loadImageById, updateNodeData]
  );

  /**
   * Clear the output image
   */
  const handleClearImage = useCallback(() => {
    updateNodeData(nodeId, { outputImage: null, status: "idle", error: null });
  }, [nodeId, updateNodeData]);

  return {
    isLoadingCarouselImage,
    loadImageById,
    handleCarouselPrevious,
    handleCarouselNext,
    handleClearImage,
  };
}
