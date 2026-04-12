import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface ManifestNode {
  type: string;
  name: string;
}

interface Manifest {
  id: string;
  isCore?: boolean;
  nodes: ManifestNode[];
}

const CUSTOM_NODES_DIR = path.resolve(process.cwd(), 'custom_nodes');

function readManifest(manifestPath: string): Manifest | null {
  try {
    if (!fs.existsSync(manifestPath)) return null;
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

/**
 * GET /api/node-registry/active-types
 * Returns the list of active node types based on installed packs in custom_nodes/.
 */
export async function GET() {
  try {
    const activeTypes: string[] = [];
    const seenTypes = new Set<string>();

    if (!fs.existsSync(CUSTOM_NODES_DIR)) {
      return NextResponse.json({ nodeTypes: [] });
    }

    const entries = fs.readdirSync(CUSTOM_NODES_DIR, { withFileTypes: true });

    // Process agent1-foundation first (core), then others
    const sorted = [...entries].sort((a, b) => {
      if (a.name === 'agent1-foundation') return -1;
      if (b.name === 'agent1-foundation') return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.tmp-')) continue;

      const manifestPath = path.join(CUSTOM_NODES_DIR, entry.name, 'manifest.json');
      const manifest = readManifest(manifestPath);
      if (!manifest || !Array.isArray(manifest.nodes)) continue;

      for (const node of manifest.nodes) {
        if (seenTypes.has(node.type)) {
          console.warn(`[active-types] Duplicate node type "${node.type}" in pack "${manifest.id}" — skipped`);
          continue;
        }
        activeTypes.push(node.type);
        seenTypes.add(node.type);
      }
    }

    return NextResponse.json({ nodeTypes: activeTypes });
  } catch (error) {
    console.error('[active-types] Error:', error);
    return NextResponse.json({ nodeTypes: [], error: 'Failed to scan installed packs' }, { status: 500 });
  }
}
