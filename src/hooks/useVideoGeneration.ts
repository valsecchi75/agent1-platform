import { useCallback, useState } from "react";
import { useWorkflowStore } from "@/store/workflowStore";

/**
 * Hook encapsulating video generation API logic and state management.
 * Abstracts generation calls, loading states, error handling, result processing, and polling.
 */
export function useVideoGeneration(nodeId: string) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const generationsPath = useWorkflowStore((state) => state.generationsPath);
  const [isLoadingCarouselVideo, setIsLoadingCarouselVideo] = useState(false);

  /**
   * Load video by ID from the generations folder
   */
  const loadVideoById = useCallback(
    async (videoId: string) => {
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
            imageId: videoId,
          }),
        });

        const result = await response.json();
        if (!result.success) {
          console.log(`Video not found: ${videoId}`);
          return null;
        }
        return result.video || result.image;
      } catch (error) {
        console.warn("Error loading video:", error);
        return null;
      }
    },
    [generationsPath]
  );

  /**
   * Navigate to previous video in carousel history
   */
  const handleCarouselPrevious = useCallback(
    async (
      videoHistory: Array<{ id: string }> | undefined,
      selectedVideoHistoryIndex: number | undefined
    ) => {
      const history = videoHistory || [];
      if (history.length === 0 || isLoadingCarouselVideo) return;

      const currentIndex = selectedVideoHistoryIndex || 0;
      const newIndex = currentIndex === 0 ? history.length - 1 : currentIndex - 1;
      const videoItem = history[newIndex];

      setIsLoadingCarouselVideo(true);
      const video = await loadVideoById(videoItem.id);
      setIsLoadingCarouselVideo(false);

      if (video) {
        updateNodeData(nodeId, {
          outputVideo: video,
          selectedVideoHistoryIndex: newIndex,
        });
      }
    },
    [nodeId, isLoadingCarouselVideo, loadVideoById, updateNodeData]
  );

  /**
   * Navigate to next video in carousel history
   */
  const handleCarouselNext = useCallback(
    async (
      videoHistory: Array<{ id: string }> | undefined,
      selectedVideoHistoryIndex: number | undefined
    ) => {
      const history = videoHistory || [];
      if (history.length === 0 || isLoadingCarouselVideo) return;

      const currentIndex = selectedVideoHistoryIndex || 0;
      const newIndex = (currentIndex + 1) % history.length;
      const videoItem = history[newIndex];

      setIsLoadingCarouselVideo(true);
      const video = await loadVideoById(videoItem.id);
      setIsLoadingCarouselVideo(false);

      if (video) {
        updateNodeData(nodeId, {
          outputVideo: video,
          selectedVideoHistoryIndex: newIndex,
        });
      }
    },
    [nodeId, isLoadingCarouselVideo, loadVideoById, updateNodeData]
  );

  /**
   * Clear the output video
   */
  const handleClearVideo = useCallback(() => {
    updateNodeData(nodeId, { outputVideo: null, status: "idle", error: null });
  }, [nodeId, updateNodeData]);

  return {
    isLoadingCarouselVideo,
    loadVideoById,
    handleCarouselPrevious,
    handleCarouselNext,
    handleClearVideo,
  };
}
