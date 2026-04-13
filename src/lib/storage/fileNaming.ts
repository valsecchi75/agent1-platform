/**
 * AGENT 1 File Naming & Storage Paths
 *
 * All generated files follow the naming convention: agent1_XXXX.ext
 * where XXXX is a zero-padded progressive number.
 *
 * Storage structure:
 *   storage/input/          — uploaded source images
 *   storage/output/images/  — generated images (agent1_0001.jpg, agent1_0002.png, ...)
 *   storage/output/videos/  — generated videos (agent1_0001.mp4, ...)
 *   storage/output/audio/   — generated audio files
 *   storage/workflows/      — workflow JSON templates
 */

import { readdirSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";

const STORAGE_DIR = resolve(process.cwd(), "storage");

export const STORAGE_PATHS = {
  input: join(STORAGE_DIR, "input"),
  images: join(STORAGE_DIR, "output", "images"),
  videos: join(STORAGE_DIR, "output", "videos"),
  audio: join(STORAGE_DIR, "output", "audio"),
  workflows: join(STORAGE_DIR, "workflows"),
};

/**
 * Ensure all storage directories exist
 */
export function ensureStorageDirs(): void {
  Object.values(STORAGE_PATHS).forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Get the next progressive number for a given directory.
 * Scans existing files matching agent1_XXXX pattern and returns next number.
 */
export function getNextProgressiveNumber(directory: string): number {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
    return 1;
  }

  const files = readdirSync(directory);
  let maxNum = 0;

  for (const file of files) {
    const match = file.match(/^agent1_(\d{4})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return maxNum + 1;
}

/**
 * Generate the next filename for a given type and extension.
 * Returns: { filename: "agent1_0042.jpg", fullPath: "/abs/path/agent1_0042.jpg" }
 */
export function getNextFilename(
  type: "image" | "video" | "audio" | "input",
  extension: string
): { filename: string; fullPath: string; publicUrl: string } {
  const directory = type === "image" ? STORAGE_PATHS.images
    : type === "video" ? STORAGE_PATHS.videos
    : type === "audio" ? STORAGE_PATHS.audio
    : STORAGE_PATHS.input;

  const num = getNextProgressiveNumber(directory);
  const padded = String(num).padStart(4, "0");
  const filename = `agent1_${padded}.${extension}`;
  const fullPath = join(directory, filename);

  const publicUrl = type === "image" ? `/api/output-browser?path=images/${filename}`
    : type === "video" ? `/api/output-browser?path=videos/${filename}`
    : type === "audio" ? `/api/output-browser?path=audio/${filename}`
    : `/api/input-images?file=${filename}`;

  return { filename, fullPath, publicUrl };
}
