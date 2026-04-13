import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { NodePackRegistry } from '@/types/nodePacks';
import { validateManifest } from '@/lib/nodePacks/validation';
import { getAppVersion, isAppVersionCompatible } from '@/lib/nodePacks/appVersion';

const CUSTOM_NODES_DIR = path.resolve(process.cwd(), 'custom_nodes');

/** Core pack IDs that can never be modified via install/uninstall */
const CORE_PACK_IDS = ['agent1-foundation'];

/** Load registry.json from local fallback */
function loadLocalRegistry(): NodePackRegistry | null {
  try {
    const localPath = path.resolve(process.cwd(), '..', 'agent1-registry', 'registry.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf-8');
      const data = JSON.parse(raw);
      // Handle both "packs" and "custom_nodes" keys
      const packs = data.packs || data.custom_nodes;
      if (data && Array.isArray(packs)) {
        return { ...data, packs } as NodePackRegistry;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/** Recursively delete a directory */
function rmDirSync(dirPath: string) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/** Download a file from URL and return its content as string */
async function downloadFile(url: string, maxSizeBytes = 512000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const text = await res.text();
    if (text.length > maxSizeBytes) throw new Error(`File exceeds max size (${maxSizeBytes} bytes)`);
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  const tmpDir: string[] = []; // track temp dirs for cleanup

  try {
    const body = await request.json();
    const { packId, registryUrl } = body as { packId: string; registryUrl?: string };

    if (!packId) {
      return NextResponse.json({ success: false, error: 'packId is required' }, { status: 400 });
    }

    if (CORE_PACK_IDS.includes(packId)) {
      return NextResponse.json({ success: false, error: 'Cannot reinstall core packs' }, { status: 400 });
    }

    // 1. Load registry to find pack entry
    let registry: NodePackRegistry | null = null;
    if (registryUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(registryUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) registry = (await res.json()) as NodePackRegistry;
      } catch { /* fallback below */ }
    }
    if (!registry) registry = loadLocalRegistry();
    if (!registry) {
      return NextResponse.json({ success: false, error: 'Cannot reach registry' }, { status: 502 });
    }

    const packEntry = registry.packs.find((p) => p.id === packId);
    if (!packEntry) {
      return NextResponse.json({ success: false, error: `Pack "${packId}" not found in registry` }, { status: 404 });
    }

    // 2. Check minAppVersion
    const appVersion = getAppVersion();
    if (!isAppVersionCompatible(appVersion, packEntry.minAppVersion)) {
      return NextResponse.json({
        success: false,
        error: `Requires app v${packEntry.minAppVersion}+ (current: v${appVersion})`,
      }, { status: 409 });
    }

    const baseUrl = registry.baseUrl.replace(/\/$/, '');

    // 3. Download manifest to temp dir
    const tempPath = path.join(CUSTOM_NODES_DIR, `.tmp-${packId}`);
    rmDirSync(tempPath); // clean any previous failed attempt
    fs.mkdirSync(tempPath, { recursive: true });
    tmpDir.push(tempPath);

    const manifestUrl = `${baseUrl}/${packEntry.manifestPath}`;
    const manifestRaw = await downloadFile(manifestUrl);
    const manifestData = JSON.parse(manifestRaw);

    // 4. Validate manifest
    const validation = validateManifest(manifestData);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid manifest',
        details: validation.errors,
      }, { status: 400 });
    }

    // TODO: Component availability check — verify that all node types in the manifest
    // have corresponding React components in the app bundle. This will be implemented
    // when nodeRegistry.ts is created (Task 18). For now, manifest validation ensures
    // the pack structure is correct.

    // 5. Write manifest
    fs.writeFileSync(path.join(tempPath, 'manifest.json'), manifestRaw, 'utf-8');

    // 6. Download specs
    const specsDir = path.join(tempPath, 'specs');
    fs.mkdirSync(specsDir, { recursive: true });

    for (const node of validation.data.nodes) {
      if (node.specFile) {
        const packDir = packEntry.manifestPath.replace('/manifest.json', '');
        const specUrl = `${baseUrl}/${packDir}/${node.specFile}`;
        try {
          const specRaw = await downloadFile(specUrl);
          const specFileName = path.basename(node.specFile);
          fs.writeFileSync(path.join(specsDir, specFileName), specRaw, 'utf-8');
        } catch (err) {
          return NextResponse.json({
            success: false,
            error: `Failed to download spec file: ${node.specFile}`,
            details: err instanceof Error ? err.message : 'Unknown error',
          }, { status: 502 });
        }
      }
    }

    // 7. Download preview (non-blocking)
    if (packEntry.previewPath) {
      try {
        const previewDir = path.join(tempPath, 'preview');
        fs.mkdirSync(previewDir, { recursive: true });
        const previewUrl = `${baseUrl}/${packEntry.previewPath}`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(previewUrl, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length <= 512000) { // 500KB max
            const filename = path.basename(packEntry.previewPath);
            fs.writeFileSync(path.join(previewDir, filename), buffer);
          }
        }
      } catch {
        console.warn(`[install] Preview download failed for ${packId} — continuing`);
      }
    }

    // 8. Atomic move: temp → final
    const finalPath = path.join(CUSTOM_NODES_DIR, packId);
    rmDirSync(finalPath); // remove old version if updating
    fs.renameSync(tempPath, finalPath);
    tmpDir.length = 0; // clear cleanup since rename succeeded

    return NextResponse.json({ success: true, restartRequired: true, version: validation.data.version });
  } catch (error) {
    console.error('[node-packs/install] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Install failed',
    }, { status: 500 });
  } finally {
    // Cleanup temp dirs on failure
    for (const dir of tmpDir) {
      rmDirSync(dir);
    }
  }
}
