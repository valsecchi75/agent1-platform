/**
 * Model Filtering Utilities
 *
 * Shared logic for filtering models by search query.
 */

import { ProviderModel } from "@/lib/providers/types";

/**
 * Filter models by search query (client-side filtering)
 * Searches across model name, description, and ID
 */
export function filterModelsBySearch(
  models: ProviderModel[],
  searchQuery: string
): ProviderModel[] {
  const searchLower = searchQuery.toLowerCase();
  return models.filter((model) => {
    const nameMatch = model.name.toLowerCase().includes(searchLower);
    const descMatch =
      model.description?.toLowerCase().includes(searchLower) || false;
    const idMatch = model.id.toLowerCase().includes(searchLower);
    return nameMatch || descMatch || idMatch;
  });
}
