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

/**
 * GET /api/node-packs/registry
 * Fetch remote node pack registry, enriched with local install status.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const registryUrl = searchParams.get('url');

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
