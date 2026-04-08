/**
 * Morpheus Model Management Executor
 *
 * When executed, outputs the selected talent's image, description, and metadata.
 * The description is available as a @variable in downstream PromptConstructor nodes.
 */

import type { NodeExecutionContext } from "../types";
import type { MorpheusModelManagementData } from "@/types/customNodes";

const PACK_ID = "morpheus-model-management";
const CONFIG_DIR = "morpheus_model_management";

export async function executeMorpheusModelManagement(ctx: NodeExecutionContext): Promise<void> {
  const { node, updateNodeData } = ctx;
  const data = node.data as MorpheusModelManagementData;

  updateNodeData(node.id, { status: "loading", error: null });

  try {
    // Validate selection
    if (!data.selectedTalentId) {
      throw new Error("No talent selected. Please select a talent from the catalog.");
    }

    // Load catalog — remote when authenticated, local demo otherwise
    const SUPABASE_BASE = "https://hrlwqnqqgcxxezagyfah.supabase.co";
    const REMOTE_CATALOG_URL = `${SUPABASE_BASE}/storage/v1/object/public/morpheus-catalog/catalog.json`;

    let catalog: { talents?: any[] } | null = null;
    if (data.patreonAuthenticated) {
      try {
        const remoteRes = await fetch(REMOTE_CATALOG_URL);
        if (remoteRes.ok) catalog = await remoteRes.json();
      } catch { /* fall through to local */ }
    }
    if (!catalog) {
      const catalogRes = await fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/catalog.json`);
      if (!catalogRes.ok) {
        throw new Error(`Failed to load talent catalog: ${catalogRes.status}`);
      }
      catalog = await catalogRes.json();
    }

    // Find the selected talent
    if (!catalog) throw new Error("Talent catalog not loaded.");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const talent = (catalog as any).talents?.find((t: any) => t.id === data.selectedTalentId);
    if (!talent) {
      throw new Error(`Talent "${data.selectedTalentId}" not found in catalog.`);
    }

    // Build the description output (used as @variable value)
    const talentName = talent.name || "Unknown";
    const variableName = data.variableName || talentName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    // Build rich description for downstream nodes
    const descriptionParts: string[] = [];
    if (talent.gender) descriptionParts.push(talent.gender);
    if (talent.age_group) descriptionParts.push(talent.age_group.replace(/_/g, " "));
    if (talent.ethnicity) descriptionParts.push(talent.ethnicity);
    if (talent.skin_tone) descriptionParts.push(`${talent.skin_tone.replace(/_/g, " ")} skin`);
    if (talent.hair_color && talent.hair_style) {
      descriptionParts.push(`${talent.hair_style.replace(/_/g, " ")} ${talent.hair_color} hair`);
    }
    if (talent.eye_color) descriptionParts.push(`${talent.eye_color} eyes`);
    if (talent.body_type) descriptionParts.push(`${talent.body_type.replace(/_/g, " ")} build`);
    if (talent.freckles) descriptionParts.push("with freckles");

    const physicalDescription = descriptionParts.join(", ");
    const fullDescription = talent.description
      ? `${talent.name}: ${talent.description} Physical traits: ${physicalDescription}.`
      : `${talent.name}: ${physicalDescription}.`;

    // Build metadata JSON
    const metadata = {
      id: talent.id,
      name: talent.name,
      variable: `@${variableName}`,
      gender: talent.gender,
      age_group: talent.age_group,
      ethnicity: talent.ethnicity,
      skin_tone: talent.skin_tone,
      hair_color: talent.hair_color,
      hair_style: talent.hair_style,
      eye_color: talent.eye_color,
      body_type: talent.body_type,
      freckles: talent.freckles,
      tags: talent.tags,
      copyright: talent.copyright,
    };

    // Get the talent image and convert to base64 for downstream compatibility
    // (Gemini API requires base64, not URLs)
    const imageSource = data.selectedTalentImage || talent.image_path || talent.thumbnail_url || null;
    let outputImage: string | null = null;

    if (imageSource) {
      if (imageSource.startsWith("data:")) {
        // Already base64
        outputImage = imageSource;
      } else {
        // Fetch and convert URL → base64
        try {
          const imgRes = await fetch(imageSource);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            const mime = blob.type || "image/jpeg";
            outputImage = `data:${mime};base64,${base64}`;
          }
        } catch {
          // If fetch fails, pass the URL as fallback (preview still works)
          outputImage = imageSource;
        }
      }
    }

    updateNodeData(node.id, {
      outputImage,
      outputDescription: fullDescription,
      outputMetadata: JSON.stringify(metadata, null, 2),
      variableName,
      status: "complete",
      error: null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Execution failed";
    updateNodeData(node.id, { status: "error", error: msg });
    throw new Error(msg);
  }
}
