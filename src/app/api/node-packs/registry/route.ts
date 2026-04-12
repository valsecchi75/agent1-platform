import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';
import type { NodePackRegistry, NodePackEntryWithStatus } from '@/types/nodePacks';

/** Load node-packs.json from local agent1-registry folder (fallback) */
function loadLocalRegistry(): NodePackRegistry | null {
  try {
    const localPath = path.resolve(process.cwd(), '..', 'agent1-registry', 'node-packs.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      const registry = JSON.parse(raw) as NodePackRegistry;
      if (registry && Array.isArray(registry.packs)) return registry;
    }
  } catch { /* ignore */ }
  return null;
}

/** Read installed pack manifest version from custom_nodes/{packId}/manifest.json */
function getInstalledVersion(packId: string): string | null {
  try {
    const manifestPath = path.resolve(process.cwd(), 'custom_nodes', packId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return manifest.version || null;
  } catch {
    return null;
  }
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
          const data = (await response.json()) as NodePackRegistry;
          if (data && Array.isArray(data.packs)) {
            registry = data;
            source = 'remote';
          }
        }
      } catch { /* remote failed, try local */ }
    }

    // Local fallback
    if (!registry) {
      registry = loadLocalRegistry();
      if (registry) {
        console.log('[node-packs] Remote unavailable — serving local node-packs.json');
      }
    }

    if (!registry) {
      return NextResponse.json(
        { success: false, error: 'Registry unavailable (remote and local fallback both failed)' },
        { status: 502 }
      );
    }

    // Enrich each pack with install status
    const packs: NodePackEntryWithStatus[] = registry.packs.map((pack) => {
      const installedVersion = getInstalledVersion(pack.id);
      let status: NodePackEntryWithStatus['status'] = 'available';

      if (installedVersion) {
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
