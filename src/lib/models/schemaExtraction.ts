/**
 * Shared Schema Extraction Utilities
 *
 * Centralized logic for extracting ModelParameters and ModelInputs from OpenAPI schemas.
 * Used by both /api/models/route.ts and /api/models/[modelId]/route.ts
 */

import { ModelParameter, ModelInput } from "@/lib/providers/types";

// Image input property patterns
const IMAGE_INPUT_PATTERNS = [
  "image_url",
  "image_urls",
  "image",
  "images",
  "image_input",
  "input_image",
  "first_frame",
  "last_frame",
  "tail_image_url",
  "start_image",
  "end_image",
  "reference_image",
  "init_image",
  "mask_image",
  "control_image",
];

// Text input properties
const TEXT_INPUT_NAMES = ["prompt", "negative_prompt"];

// Properties that start with "image_" but are NOT image inputs
const IMAGE_PREFIX_EXCLUSIONS = ["image_size"];

// Parameters to filter out (internal/system params)
const EXCLUDED_PARAMS = new Set([
  "webhook",
  "webhook_events_filter",
  "sync_mode",
  "disable_safety_checker",
  "go_fast",
  "enable_safety_checker",
  "output_format",
  "output_quality",
  "request_id",
]);

// Parameters we want to surface (user-relevant)
const PRIORITY_PARAMS = new Set([
  "seed",
  "num_inference_steps",
  "inference_steps",
  "steps",
  "guidance_scale",
  "guidance",
  "negative_prompt",
  "width",
  "height",
  "image_size",
  "num_outputs",
  "num_images",
  "scheduler",
  "strength",
  "cfg_scale",
  "lora_scale",
]);

interface ExtractedSchema {
  parameters: ModelParameter[];
  inputs: ModelInput[];
}

/**
 * Convert property name to human-readable label
 */
export function toLabel(name: string): string {
  return name
    .replace(/_url$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve a $ref reference in OpenAPI schema
 * E.g., "#/components/schemas/AspectRatio" -> schema object
 */
function resolveRef(
  ref: string,
  schemaComponents: Record<string, unknown>
): Record<string, unknown> | null {
  // Parse reference path like "#/components/schemas/AspectRatio"
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  if (!match) return null;

  const schemaName = match[1];
  const resolved = schemaComponents[schemaName] as Record<string, unknown> | undefined;
  return resolved || null;
}

/**
 * Resolve the effective type and format from an OpenAPI property.
 *
 * Handles wrapper patterns used by code generators (e.g. Pydantic → OpenAPI):
 *   - anyOf / oneOf: picks the first non-null type (nullable pattern)
 *   - allOf: merges referenced schemas
 *   - $ref: resolves from schemaComponents
 *   - Direct type: returns immediately (fast path — no behavior change)
 */
export function resolvePropertyType(
  prop: Record<string, unknown>,
  schemaComponents?: Record<string, unknown>
): { type?: string; format?: string } {
  // Fast path: direct type is defined — existing behaviour, no change
  if (prop.type !== undefined) {
    return { type: prop.type as string, format: prop.format as string | undefined };
  }

  // anyOf / oneOf — pick the first non-null variant
  const variants = (prop.anyOf ?? prop.oneOf) as Array<Record<string, unknown>> | undefined;
  if (variants && Array.isArray(variants)) {
    for (const variant of variants) {
      // Resolve $ref inside variant
      if (variant.$ref && typeof variant.$ref === "string" && schemaComponents) {
        const resolved = resolveRef(variant.$ref as string, schemaComponents);
        if (resolved && resolved.type && resolved.type !== "null") {
          return { type: resolved.type as string, format: (resolved.format ?? prop.format) as string | undefined };
        }
      }
      if (variant.type && variant.type !== "null") {
        return { type: variant.type as string, format: (variant.format ?? prop.format) as string | undefined };
      }
    }
  }

  // allOf — merge referenced schemas
  const allOf = prop.allOf as Array<Record<string, unknown>> | undefined;
  if (allOf && Array.isArray(allOf) && schemaComponents) {
    for (const item of allOf) {
      if (item.$ref && typeof item.$ref === "string") {
        const resolved = resolveRef(item.$ref as string, schemaComponents);
        if (resolved && resolved.type) {
          return { type: resolved.type as string, format: (resolved.format ?? prop.format) as string | undefined };
        }
      }
      if (item.type) {
        return { type: item.type as string, format: (item.format ?? prop.format) as string | undefined };
      }
    }
  }

  // $ref at top level
  if (prop.$ref && typeof prop.$ref === "string" && schemaComponents) {
    const resolved = resolveRef(prop.$ref as string, schemaComponents);
    if (resolved && resolved.type) {
      return { type: resolved.type as string, format: (resolved.format ?? prop.format) as string | undefined };
    }
  }

  return {};
}

/**
 * Check if property is an image input based on BOTH schema type AND name.
 *
 * Image inputs must be strings (URLs or base64) or arrays of strings.
 * Integers, booleans, numbers with "image" in the name are NOT image inputs.
 */
export function isImageInput(
  name: string,
  prop: Record<string, unknown>,
  schemaComponents?: Record<string, unknown>
): boolean {
  // First check: must be a string type (images are URLs or base64 strings)
  // Integers, booleans, numbers are NEVER image inputs regardless of name
  const resolved = resolvePropertyType(prop, schemaComponents);
  const propType = resolved.type;
  if (propType !== "string" && propType !== "array") {
    return false;
  }

  // For arrays, check if items are strings (or unspecified - be lenient)
  if (propType === "array") {
    const items = prop.items as Record<string, unknown> | undefined;
    // Only reject if items.type is explicitly specified AND not "string"
    // Many schemas don't specify items type for image arrays
    if (items && items.type && items.type !== "string") {
      return false;
    }
  }

  // Check exclusions (e.g., image_size is a parameter, not an image input)
  if (IMAGE_PREFIX_EXCLUSIONS.includes(name)) {
    return false;
  }

  // Check format hints (OpenAPI format field or resolved format) - strong signal for image URLs
  const format = (prop.format ?? resolved.format) as string | undefined;
  if (format === "uri" || format === "data-uri" || format === "binary") {
    // Only treat as image if name also suggests it's an image
    if (IMAGE_INPUT_PATTERNS.includes(name) ||
        name.endsWith("_image") ||
        name.startsWith("image_") ||
        name.includes("_image_")) {
      return true;
    }
  }

  // Check description for image-related keywords
  const description = (prop.description as string || "").toLowerCase();
  if (description.includes("image url") ||
      description.includes("base64 image") ||
      description.includes("data uri") ||
      description.includes("image file") ||
      description.includes("url of the image") ||
      description.includes("path to image")) {
    return true;
  }

  // Check explicit patterns (exact matches like "image_url", "image")
  if (IMAGE_INPUT_PATTERNS.includes(name)) {
    return true;
  }

  // More restrictive name pattern matching for strings
  // Exclude names that suggest counts or settings rather than actual images
  if (name.includes("_images") ||    // max_images, num_images
      name.includes("guidance") ||   // image_guidance_scale
      name.includes("generation") || // sequential_image_generation
      name.includes("_count") ||     // image_count
      name.includes("_size") ||      // image_size (already in exclusions but belt-and-suspenders)
      name.includes("_scale")) {     // image_scale
    return false;
  }

  // Finally, check name patterns for remaining string types
  return name.endsWith("_image") ||
         name.startsWith("image_") ||
         name.includes("_image_");
}

/**
 * Check if property is a text input
 */
export function isTextInput(name: string): boolean {
  return TEXT_INPUT_NAMES.includes(name);
}

/**
 * Convert OpenAPI schema property to ModelParameter
 */
export function convertSchemaProperty(
  name: string,
  prop: Record<string, unknown>,
  required: string[],
  schemaComponents?: Record<string, unknown>
): ModelParameter | null {
  // Skip excluded parameters
  if (EXCLUDED_PARAMS.has(name)) {
    return null;
  }

  // Determine type and extract enum from allOf/$ref/anyOf/oneOf if present
  let type: ModelParameter["type"] = "string";
  let enumValues: unknown[] | undefined;
  let resolvedDefault: unknown;
  let resolvedDescription: string | undefined;

  // Use resolvePropertyType() to handle anyOf/oneOf/allOf/$ref patterns
  const resolved = resolvePropertyType(prop, schemaComponents);
  const effectiveType = resolved.type;

  if (effectiveType === "integer") {
    type = "integer";
  } else if (effectiveType === "number") {
    type = "number";
  } else if (effectiveType === "boolean") {
    type = "boolean";
  } else if (effectiveType === "array") {
    type = "array";
  }

  // Extract enum/default/description from allOf with $ref
  const allOf = prop.allOf as Array<Record<string, unknown>> | undefined;
  if (allOf && allOf.length > 0 && schemaComponents) {
    for (const item of allOf) {
      const itemRef = item.$ref as string | undefined;
      if (itemRef) {
        const refResolved = resolveRef(itemRef, schemaComponents);
        if (refResolved) {
          if (Array.isArray(refResolved.enum)) {
            enumValues = refResolved.enum;
          }
          if (refResolved.default !== undefined && resolvedDefault === undefined) {
            resolvedDefault = refResolved.default;
          }
          if (refResolved.description && !resolvedDescription) {
            resolvedDescription = refResolved.description as string;
          }
        }
      } else if (Array.isArray(item.enum)) {
        enumValues = item.enum;
      }
    }
  }

  // Extract enum/default/description from anyOf/oneOf variants
  const variants = (prop.anyOf ?? prop.oneOf) as Array<Record<string, unknown>> | undefined;
  if (variants && Array.isArray(variants)) {
    for (const variant of variants) {
      if (variant.type === "null") continue;
      // Resolve $ref inside variant
      if (variant.$ref && typeof variant.$ref === "string" && schemaComponents) {
        const refResolved = resolveRef(variant.$ref as string, schemaComponents);
        if (refResolved) {
          if (Array.isArray(refResolved.enum) && !enumValues) {
            enumValues = refResolved.enum;
          }
          if (refResolved.default !== undefined && resolvedDefault === undefined) {
            resolvedDefault = refResolved.default;
          }
          if (refResolved.description && !resolvedDescription) {
            resolvedDescription = refResolved.description as string;
          }
        }
      } else {
        if (Array.isArray(variant.enum) && !enumValues) {
          enumValues = variant.enum;
        }
        if (variant.default !== undefined && resolvedDefault === undefined) {
          resolvedDefault = variant.default;
        }
      }
    }
  }

  const parameter: ModelParameter = {
    name,
    type,
    description: (prop.description as string | undefined) || resolvedDescription,
    default: prop.default !== undefined ? prop.default : resolvedDefault,
    required: required.includes(name),
  };

  // Add constraints
  if (typeof prop.minimum === "number") {
    parameter.minimum = prop.minimum;
  }
  if (typeof prop.maximum === "number") {
    parameter.maximum = prop.maximum;
  }

  // Use enum from property directly, or from resolved $ref
  if (Array.isArray(prop.enum)) {
    parameter.enum = prop.enum;
  } else if (enumValues) {
    parameter.enum = enumValues;
  }

  return parameter;
}

/**
 * Extract ModelParameters and ModelInputs from an OpenAPI schema object
 */
export function extractParametersFromSchema(
  schema: Record<string, unknown>,
  schemaComponents?: Record<string, unknown>
): ExtractedSchema {
  const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
  const required = (schema.required as string[]) || [];

  if (!properties) {
    return { parameters: [], inputs: [] };
  }

  const parameters: ModelParameter[] = [];
  const inputs: ModelInput[] = [];

  for (const [name, prop] of Object.entries(properties)) {
    // Check if this is a connectable input (image or text)
    // Pass both name AND prop to check schema type, not just name
    if (isImageInput(name, prop, schemaComponents)) {
      const resolvedType = resolvePropertyType(prop, schemaComponents).type;
      inputs.push({
        name,
        type: "image",
        required: required.includes(name),
        label: toLabel(name),
        description: prop.description as string | undefined,
        isArray: resolvedType === "array",
      });
      continue;
    }

    if (isTextInput(name)) {
      inputs.push({
        name,
        type: "text",
        required: required.includes(name),
        label: toLabel(name),
        description: prop.description as string | undefined,
        isArray: prop.type === "array",
      });
      continue;
    }

    // Otherwise it's a parameter
    const param = convertSchemaProperty(name, prop, required, schemaComponents);
    if (param) {
      parameters.push(param);
    }
  }

  // Sort parameters: priority params first, then alphabetically
  parameters.sort((a, b) => {
    const aIsPriority = PRIORITY_PARAMS.has(a.name);
    const bIsPriority = PRIORITY_PARAMS.has(b.name);
    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    return a.name.localeCompare(b.name);
  });

  // Sort inputs: required first, then by type (image before text), then alphabetically
  inputs.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    if (a.type !== b.type) return a.type === "image" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { parameters, inputs };
}
