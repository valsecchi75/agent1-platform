import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const CUSTOM_NODES_DIR = path.resolve(process.cwd(), 'custom_nodes');
const DISABLED_DIR = path.join(CUSTOM_NODES_DIR, '.disabled');

export async function POST(request: Request) {
  try {
    const { packId } = (await request.json()) as { packId: string };

    if (!packId) {
      return NextResponse.json({ success: false, error: 'packId is required' }, { status: 400 });
    }

    const disabledPackPath = path.join(DISABLED_DIR, packId);

    if (!fs.existsSync(disabledPackPath)) {
      return NextResponse.json({ success: false, error: `Disabled pack "${packId}" not found` }, { status: 404 });
    }

    const targetPackPath = path.join(CUSTOM_NODES_DIR, packId);

    // Check if pack is already active (conflict)
    if (fs.existsSync(targetPackPath)) {
      return NextResponse.json({
        success: false,
        error: `Active pack "${packId}" already exists`,
      }, { status: 409 });
    }

    // Move pack back to active
    fs.renameSync(disabledPackPath, targetPackPath);

    return NextResponse.json({ success: true, restartRequired: true });
  } catch (error) {
    console.error('[node-packs/enable] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Enable failed',
    }, { status: 500 });
  }
}
