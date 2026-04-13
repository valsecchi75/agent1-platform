import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const CUSTOM_NODES_DIR = path.resolve(process.cwd(), 'custom_nodes');
const CORE_PACK_IDS = ['agent1-foundation'];

export async function POST(request: Request) {
  try {
    const { packId } = (await request.json()) as { packId: string };

    if (!packId) {
      return NextResponse.json({ success: false, error: 'packId is required' }, { status: 400 });
    }

    // Hardcoded core protection by ID
    if (CORE_PACK_IDS.includes(packId)) {
      return NextResponse.json({ success: false, error: 'Cannot uninstall core packs' }, { status: 403 });
    }

    const packPath = path.join(CUSTOM_NODES_DIR, packId);

    if (!fs.existsSync(packPath)) {
      return NextResponse.json({ success: false, error: `Pack "${packId}" not found` }, { status: 404 });
    }

    // Additional manifest-based protection
    try {
      const manifestPath = path.join(packPath, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifest.isCore || manifest.removable === false) {
          return NextResponse.json({ success: false, error: 'This pack cannot be removed' }, { status: 403 });
        }
      }
    } catch { /* proceed with removal if manifest can't be read */ }

    // Remove pack directory
    fs.rmSync(packPath, { recursive: true, force: true });

    return NextResponse.json({ success: true, restartRequired: true });
  } catch (error) {
    console.error('[node-packs/uninstall] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Uninstall failed',
    }, { status: 500 });
  }
}
