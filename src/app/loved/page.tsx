"use client";

import { useState, useEffect, useCallback } from "react";
import { GalleryFilterBar } from "@/components/gallery/GalleryFilterBar";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { GalleryLightbox } from "@/components/gallery/GalleryLightbox";
import { PageHeader } from "@/components/PageHeader";
import { Toast, useToast } from "@/components/Toast";
import { DbGeneration, GenerationFilters, GenerationListResponse } from "@/lib/db-types";

const LIMIT = 50;

export default function LovedPage() {
  const [generations, setGenerations] = useState<DbGeneration[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [filters, setFilters] = useState<GenerationFilters>({
    isLoved: true,
    limit: LIMIT,
    offset: 0,
  });

  const [providers, setProviders] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  const [lightboxGen, setLightboxGen] = useState<DbGeneration | null>(null);

  // Fetch loved generations
  const fetchGenerations = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append("isLoved", "true");
      if (filters.provider) params.append("provider", filters.provider);
      if (filters.model) params.append("model", filters.model);
      if (filters.fileType) params.append("fileType", filters.fileType);
      if (filters.limit) params.append("limit", filters.limit.toString());
      if (filters.offset) params.append("offset", filters.offset.toString());

      const response = await fetch(`/api/db/generations?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch loved generations");

      const data: GenerationListResponse = await response.json();
      setGenerations(data.generations);
      setTotalCount(data.total);

      // Calculate total cost
      const cost = data.generations.reduce((sum, gen) => sum + gen.cost_usd, 0);
      setTotalCost(cost);

      // Extract unique providers and models
      const uniqueProviders = Array.from(
        new Set(data.generations.map((gen) => gen.provider))
      );
      const uniqueModels = Array.from(
        new Set(data.generations.map((gen) => gen.model))
      );

      setProviders(uniqueProviders.sort());
      setModels(uniqueModels.sort());
    } catch (err) {
      // Gracefully degrade: show empty layout instead of error
      console.error("Failed to fetch loved generations:", err);
      setGenerations([]);
      setTotalCount(0);
      setTotalCost(0);
      setProviders([]);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleFiltersChange = (newFilters: GenerationFilters) => {
    // Always keep isLoved: true
    setFilters({
      ...newFilters,
      isLoved: true,
    });
  };

  const handleLoveToggle = async (id: string) => {
    // In loved page, toggle means removing from favorites (confirm first)
    const confirmed = window.confirm("Remove from favorites?");
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/db/generations/${id}/loved`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLoved: false }),
      });

      if (!response.ok) throw new Error("Failed to remove from favorites");

      // Remove from local state
      setGenerations(generations.filter((g) => g.id !== id));
      setTotalCount(Math.max(0, totalCount - 1));

      if (lightboxGen?.id === id) {
        setLightboxGen(null);
      }

      toast.show("Removed from favorites", "success");
    } catch (err) {
      toast.show("Failed to remove from favorites", "error");
      console.error("Failed to toggle loved:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/db/generations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete generation");

      setGenerations(generations.filter((g) => g.id !== id));
      setTotalCount(Math.max(0, totalCount - 1));

      if (lightboxGen?.id === id) {
        setLightboxGen(null);
      }

      toast.show("Generation deleted", "success");
    } catch (err) {
      toast.show("Failed to delete generation", "error");
      console.error("Failed to delete:", err);
    }
  };

  const handleOpenLightbox = (gen: DbGeneration) => {
    setLightboxGen(gen);
  };

  const currentIndex = lightboxGen ? generations.findIndex((g) => g.id === lightboxGen.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < generations.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      setLightboxGen(generations[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setLightboxGen(generations[currentIndex + 1]);
    }
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--background)" }}>
      <PageHeader />

      {/* Page title */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Favorites
        </h1>
      </div>

      <GalleryFilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        totalCount={totalCount}
        totalCost={totalCost}
        providers={providers}
        models={models}
        showLovedFilter={false}
      />

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
          </div>
        ) : (
          <GalleryGrid
            generations={generations}
            onLoveToggle={handleLoveToggle}
            onDelete={handleDelete}
            onOpenLightbox={handleOpenLightbox}
          />
        )}
      </div>

      <GalleryLightbox
        generation={lightboxGen}
        onClose={() => setLightboxGen(null)}
        onLoveToggle={handleLoveToggle}
        onDelete={handleDelete}
        onPrev={handlePrev}
        onNext={handleNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />

      <Toast />
    </div>
  );
}
