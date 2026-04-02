import { z } from 'zod';

/** Node type must be alphanumeric + underscores only (no spaces, no special chars) */
const nodeTypePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const manifestNodeSchema = z.object({
  type: z.string().min(1).regex(nodeTypePattern, 'Node type must be alphanumeric + underscores'),
  name: z.string().min(1),
  category: z.string().min(1),
  specFile: z.string().optional(),
});

const manifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  displayName: z.string().optional(),
  version: z.string().min(1),
  author: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  minAppVersion: z.string().optional(),
  license: z.string().optional(),
  repository: z.string().optional(),
  isCore: z.boolean(),
  removable: z.boolean(),
  nodes: z.array(manifestNodeSchema).min(1, 'Pack must declare at least one node'),
  hasSpecs: z.boolean().optional(),
  dependencies: z.array(z.string()).default([]),
});

export type ManifestValidationResult =
  | { success: true; data: z.infer<typeof manifestSchema> }
  | { success: false; errors: string[] };

export function validateManifest(data: unknown): ManifestValidationResult {
  const result = manifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  };
}
