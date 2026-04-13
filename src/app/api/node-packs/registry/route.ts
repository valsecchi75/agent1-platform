import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';
import type { NodePackRegistry, NodePackEntry, NodePackEntryWithStatus } from '@/types/nodePacks';

/** Load registry.json from local agent1-registry folder (fallback) */
function loadLocalRegistry(): NodePackRegistry | null {
  try {
    const localPath = path.resolve(process.cwd(), '..', 'agent1-registry', 'registry.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      const data = JSON.parse(raw);
      // registry.json may use "custom_nodes" or "packs" as the array key
      const packs = data.packs || data.custom_nodes;
      if (data && Array.isArray(packs)) {
        return { ...data, packs } as NodePackRegistry;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/** Build a minimal registry from locally installed custom_nodes/ manifests (last resort) */
function buildRegistryFromLocal(): NodePackRegistry | null {
  try {
    const customNodesDir = path.resolve(process.cwd(), 'custom_nodes');
    if (!fs.existsSync(customNodesDir)) return null;

    const entries = fs.readdirSync(customNodesDir, { withFileTypes: true });
    const packs: NodePackEntry[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const manifestPath = path.join(customNodesDir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        packs.push({
          id: manifest.id || entry.name,
          name: manifest.displayName || manifest.name || entry.name,
          description: manifest.description || '',
          author: manifest.author || 'Unknown',
          version: manifest.version || '0.0.0',
          category: manifest.category || 'unknown',
          tags: [],
          nodeCount: Array.isArray(manifest.nodes) ? manifest.nodes.length : 0,
          minAppVersion: manifest.minAppVersion || '0.0.0',
          manifestPath: `custom_nodes/${entry.name}/manifest.json`,
          previewPath: '',
          createdAt: '',
          updatedAt: '',
          changelog: '',
          isCore: manifest.isCore || false,
          removable: manifest.removable !== false,
        });
      } catch { /* skip invalid manifest */ }
    }

    if (packs.length === 0) return null;

    return {
      registryVersion: 'local',
      updatedAt: new Date().toISOString(),
      baseUrl: '',
      packs,
    };
  } catch { return null; }
}

/** Read installed pack manifest version from active custom_nodes/{packId}/manifest.json or disabled directory */
function getInstalledVersion(packId: string): { version: string | null; isDisabled: boolean } {
  try {
    // Check active installs first
    const manifestPath = path.resolve(process.cwd(), 'custom_nodes', packId, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return { version: manifest.version || null, isDisabled: false };
    }
  } catch { /* ignore */ }

  try {
    // Check disabled installs
    const disabledPath = path.resolve(process.cwd(), 'custom_nodes', '.disabled', packId, 'manifest.json');
    if (fs.existsSync(disabledPath)) {
      const manifest = JSON.parse(fs.readFileSync(disabledPath, 'utf-8'));
      return { version: manifest.version || null, isDisabled: true };
    }
  } catch { /* ignore */ }

  return { version: null, isDisabled: false };
}

/** Mock packs for dev testing — ?mock=<mode> */
function getMockResponse(mock: string) {
  const now = new Date().toISOString();
  const mockPacks: NodePackEntryWithStatus[] = [
    {
      id: 'agent1-neural-atelier', name: 'Neural Atelier', description: 'Professional photo-to-render pipeline with sketch, styling, and recolor nodes',
      author: 'AGENT 1 Team', version: '1.2.0', category: 'image', tags: ['photo', 'render', 'sketch'],
      nodeCount: 3, minAppVersion: '0.9.0', manifestPath: 'custom_nodes/agent1-neural-atelier/manifest.json',
      previewPath: '', createdAt: '2026-03-15T10:00:00Z', updatedAt: '2026-04-01T14:00:00Z', changelog: 'Added recolor node',
      status: 'installed', installedVersion: '1.2.0',
    },
    {
      id: 'agent1-video-toolkit', name: 'Video Toolkit', description: 'Advanced video processing: stitch, trim, frame grab, and ease curves',
      author: 'AGENT 1 Team', version: '2.0.0', category: 'video', tags: ['video', 'editing', 'motion'],
      nodeCount: 4, minAppVersion: '0.9.0', manifestPath: 'custom_nodes/agent1-video-toolkit/manifest.json',
      previewPath: '', createdAt: '2026-02-20T09:00:00Z', updatedAt: '2026-04-02T08:00:00Z', changelog: 'Major rewrite with new trim node',
      status: 'update-available', installedVersion: '1.5.0',
    },
    {
      id: 'agent1-3d-viewer', name: '3D Viewer Pack', description: 'GLB model viewer and 3D-to-image renderer for product visualization',
      author: 'Community', version: '0.3.0', category: '3d', tags: ['3d', 'glb', 'product'],
      nodeCount: 1, minAppVersion: '0.9.0', manifestPath: 'custom_nodes/agent1-3d-viewer/manifest.json',
      previewPath: '', createdAt: '2026-03-28T16:00:00Z', updatedAt: '2026-03-30T11:00:00Z', changelog: 'Initial release',
      status: 'available', installedVersion: null,
    },
    {
      id: 'agent1-audio-suite', name: 'Audio Suite', description: 'TTS generation, audio input, and audio mixing nodes',
      author: 'Community', version: '1.0.0', category: 'audio', tags: ['audio', 'tts', 'music'],
      nodeCount: 2, minAppVersion: '1.0.0', manifestPath: 'custom_nodes/agent1-audio-suite/manifest.json',
      previewPath: '', createdAt: '2026-04-01T12:00:00Z', updatedAt: '2026-04-02T09:00:00Z', changelog: 'First release',
      status: 'available', installedVersion: null,
    },
  ];

  if (mock === 'with-packs') {
    return { success: true, packs: mockPacks, source: 'mock', lastChecked: now };
  }
  if (mock === 'empty') {
    return { success: true, packs: [], source: 'mock', lastChecked: now };
  }
  if (mock === 'error') {
    return null; // will be handled as 502
  }
  if (mock === 'new-packs') {
    // All packs have very recent updatedAt — will trigger badge
    const fresh = mockPacks.map(p => ({ ...p, updatedAt: now }));
    return { success: true, packs: fresh, source: 'mock', lastChecked: now };
  }
  return null;
}

/**
 * GET /api/node-packs/registry
 * Fetch remote node pack registry, enriched with local install status.
 * Dev: ?mock=with-packs|empty|error|new-packs for testing
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const registryUrl = searchParams.get('url');
    const mock = searchParams.get('mock');

    // Dev mock mode
    if (mock) {
      const mockResult = getMockResponse(mock);
      if (!mockResult) {
        return NextResponse.json(
          { success: false, error: 'Registry unavailable (mock error mode)' },
          { status: 502 }
        );
      }
      return NextResponse.json(mockResult);
    }

    let registry: NodePackRegistry | null = null;
    let source = 'local-fallback';

    // Try remote fetch first
    if (registryUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(registryUrl, {
          headers: { Accept: 'application/json', 'User-Agent': 'AGENT1/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          // Handle both "packs" and "custom_nodes" keys
          const remotePacks = data.packs || data.custom_nodes;
          if (data && Array.isArray(remotePacks)) {
            registry = { ...data, packs: remotePacks } as NodePackRegistry;
            source = 'remote';
          }
        }
      } catch { /* remote failed, try local */ }
    }

    // Local registry.json fallback
    if (!registry) {
      registry = loadLocalRegistry();
      if (registry) {
        console.log('[node-packs] Remote unavailable — serving local registry.json');
      }
    }

    // Last resort: scan local custom_nodes/ manifests
    if (!registry) {
      registry = buildRegistryFromLocal();
      if (registry) {
        source = 'local-scan';
        console.log('[node-packs] Registry unavailable — built from local manifests');
      }
    }

    if (!registry) {
      return NextResponse.json(
        { success: false, error: 'Registry unavailable (remote, local fallback, and local scan all failed)' },
        { status: 502 }
      );
    }

    // Enrich each pack with install status
    const packs: NodePackEntryWithStatus[] = registry.packs.map((pack) => {
      const { version: installedVersion, isDisabled } = getInstalledVersion(pack.id);
      let status: NodePackEntryWithStatus['status'] = 'available';

      if (isDisabled) {
        status = 'disabled';
      } else if (installedVersion) {
        const installed = semver.parse(installedVersion);
        const remote = semver.parse(pack.version);
        if (installed && remote && semver.gt(remote, installed)) {
          status = 'update-available';
        } else {
          status = 'installed';
        }
      }

      return { ...pack, status, installedVersion };
    });

    return NextResponse.json({
      success: true,
      packs,
      source,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[node-packs/registry] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
