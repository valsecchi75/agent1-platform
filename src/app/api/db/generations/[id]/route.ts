import * as fs from "fs/promises";
import * as path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  softDeleteGeneration,
  getGenerationFilePath,
} from "@/lib/db";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";

// DELETE: Soft-delete a generation by ID
// Moves the file to .trash/ if it exists on disk
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation ID is required",
        },
        { status: 400 }
      );
    }

    // Get file path from database before soft-delete
    const filePath = getGenerationFilePath(id);

    // Soft-delete in database
    softDeleteGeneration(id);

    // Try to move file to trash if it exists
    if (filePath) {
      try {
        const fullPath = path.join(process.cwd(), filePath);
        const stats = await fs.stat(fullPath).catch(() => null);

        if (stats && stats.isFile()) {
          // Create .trash directory if it doesn't exist
          const trashDir = path.join(path.dirname(fullPath), ".trash");
          await fs.mkdir(trashDir, { recursive: true }).catch(() => {
            // Directory already exists or creation failed - continue anyway
          });

          // Move file to trash
          const filename = path.basename(fullPath);
          const trashPath = path.join(trashDir, filename);
          await fs.rename(fullPath, trashPath).catch(() => {
            // File move failed - already soft-deleted in DB, continue
          });
        }
      } catch {
        // File operations failed - already soft-deleted in DB, continue
      }
    }

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete generation",
      },
      { status: 500 }
    );
  }
}
