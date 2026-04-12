// Node Index Builder
//
// Scans custom_nodes/*/specs/ and custom_nodes/*/manifest.json to build
// a lightweight _index.json registry of all available nodes.
//
// The index enables fast lookups and node discovery without scanning
// the entire custom_nodes/ directory on every request.

import fs from "fs/promises";
import path from "path";

// ── Types ──

export interface NodeIndexEntry {
  nodeType: string;
  name: string;
  category: string;
  tags: string[];
  summary: string;
  inputTypes: string[];
  outputTypes: string[];
  requiresApiKey: boolean;
  pack: string;
}

export interface NodeIndex {
  generatedAt: string;
  nodeCount: number;
  nodes: NodeIndexEntry[];
}

/** Node spec file interface (scanned from custom_nodes/{pack}/specs/{file}.json) */
interface NodeSpec {
  nodeType: string;
  name: string;
  category: string;
  tags?: string[];
  summary?: string;
  description?: string;
  inputs?: { name: string; type: string }[];
  outputs?: { name: string; type: string }[];
  requiresApiKey?: boolean;
}

// ── Path utilities ──

function getCustomNodesRoot(): string {
  // custom_nodes/ lives inside app/ (the Next.js root = process.cwd())
  return path.join(process.cwd(), "custom_nodes");
}

function getIndexPath(): string {
  const customNodesRoot = getCustomNodesRoot();
  return path.join(customNodesRoot, "_index.json");
}

// ── Index building ──

/**
 * Extracts input/output types from a node spec
 */
function extractTypes(
  specs: { name: string; type: string }[] | undefined,
): string[] {
  if (!specs) return [];
  return [...new Set(specs.map((s) => s.type))].sort();
}

/**
 * Scans a single pack's specs directory and returns discovered nodes
 */
async function scanPackSpecs(
  packPath: string,
  packName: string,
): Promise<NodeIndexEntry[]> {
  const specsDir = path.join(packPath, "specs");
  const nodes: NodeIndexEntry[] = [];

  try {
    const stats = await fs.stat(specsDir);
    if (!stats.isDirectory()) return nodes;
  } catch {
    // specs directory doesn't exist, return empty
    return nodes;
  }

  try {
    const files = await fs.readdir(specsDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const file of jsonFiles) {
      const filePath = path.join(specsDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const spec: NodeSpec = JSON.parse(content);

        const inputTypes = extractTypes(spec.inputs);
        const outputTypes = extractTypes(spec.outputs);

        nodes.push({
          nodeType: spec.nodeType,
          name: spec.name,
          category: spec.category,
          tags: spec.tags || [],
          summary: spec.summary || spec.description || "",
          inputTypes,
          outputTypes,
          requiresApiKey: spec.requiresApiKey || false,
          pack: packName,
        });
      } catch (error) {
        console.warn(
          `[nodeIndex] Failed to parse spec ${file} in pack ${packName}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.warn(
      `[nodeIndex] Failed to read specs directory for pack ${packName}:`,
      error,
    );
  }

  return nodes;
}

/**
 * Builds the complete node index by scanning all packs
 */
export async function buildNodeIndex(): Promise<NodeIndex> {
  const customNodesRoot = getCustomNodesRoot();
  const nodes: NodeIndexEntry[] = [];

  try {
    const entries = await fs.readdir(customNodesRoot, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden dirs and special files
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
        continue;
      }

      if (!entry.isDirectory()) continue;

      const packPath = path.join(customNodesRoot, entry.name);
      const packNodes = await scanPackSpecs(packPath, entry.name);
      nodes.push(...packNodes);
    }
  } catch (error) {
    console.warn(
      "[nodeIndex] Failed to read custom_nodes directory:",
      error,
    );
  }

  // Sort by pack name, then by nodeType
  nodes.sort((a, b) => {
    if (a.pack !== b.pack) {
      return a.pack.localeCompare(b.pack);
    }
    return a.nodeType.localeCompare(b.nodeType);
  });

  const index: NodeIndex = {
    generatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    nodes,
  };

  // Write to disk
  try {
    const indexPath = getIndexPath();
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
    console.log(
      `[nodeIndex] Generated index with ${nodes.length} nodes at ${indexPath}`,
    );
  } catch (error) {
    console.error("[nodeIndex] Failed to write index file:", error);
  }

  return index;
}

/**
 * Gets the cached index if it exists, otherwise builds it
 */
export async function getNodeIndex(): Promise<NodeIndex> {
  const indexPath = getIndexPath();

  try {
    const content = await fs.readFile(indexPath, "utf-8");
    const index: NodeIndex = JSON.parse(content);
    console.log(`[nodeIndex] Loaded cached index with ${index.nodeCount} nodes`);
    return index;
  } catch (error) {
    console.log(
      "[nodeIndex] No cached index found, building new index...",
      error,
    );
    return buildNodeIndex();
  }
}

/**
 * Gets the full spec for a single node by nodeType
 */
export async function getNodeSpec(nodeType: string): Promise<NodeSpec | null> {
  const customNodesRoot = getCustomNodesRoot();

  try {
    const entries = await fs.readdir(customNodesRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) {
        continue;
      }

      if (!entry.isDirectory()) continue;

      const specsDir = path.join(customNodesRoot, entry.name, "specs");

      try {
        const stats = await fs.stat(specsDir);
        if (!stats.isDirectory()) continue;
      } catch {
        continue;
      }

      try {
        const files = await fs.readdir(specsDir);
        const jsonFiles = files.filter((f) => f.endsWith(".json"));

        for (const file of jsonFiles) {
          const filePath = path.join(specsDir, file);
          try {
            const content = await fs.readFile(filePath, "utf-8");
            const spec: NodeSpec = JSON.parse(content);

            if (spec.nodeType === nodeType) {
              return spec;
            }
          } catch {
            // Skip invalid spec files
          }
        }
      } catch {
        // Skip if can't read specs directory
      }
    }
  } catch (error) {
    console.warn("[nodeIndex] Failed to search for node spec:", error);
  }

  return null;
}
