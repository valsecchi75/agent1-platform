/**
 * AGENT 1 File Naming & Storage Paths
 *
 * All generated files follow the naming convention: agent1_XXXX.ext
 * where XXXX is a zero-padded progressive number.
 *
 * Storage structure:
 *   storage/input/                    — uploaded source images
 *   storage/output/images/            — generated images (agent1_0001.jpg, agent1_0002.png, ...)
 *   storage/output/videos/            — generated videos (agent1_0001.mp4, ...)
 *   storage/output/audio/             — generated audio files
 *   storage/workflows/                — workflow JSON templates
 *   storage/users/{userId}/           — user-scoped storage (multi-user isolation)
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
 * Get user-scoped storage paths for multi-user isolation
 * Returns paths for a specific user's files
 */
export function getUserStoragePaths(userId: string) {
  const userDir = join(STORAGE_DIR, "users", userId);
  return {
    root: userDir,
    input: join(userDir, "input"),
    images: join(userDir, "output", "images"),
    videos: join(userDir, "output", "videos"),
    audio: join(userDir, "output", "audio"),
    workflows: join(userDir, "workflows"),
    session: join(userDir, "workflows", "__session"),
  };
}

/**
 * Ensure user-scoped directories exist
 * Creates all necessary directories for a user
 */
export function ensureUserDirectories(userId: string): void {
  const paths = getUserStoragePaths(userId);
  for (const dir of Object.values(paths)) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
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
 * Optionally scoped to a user for multi-user isolation.
 * Returns: { filename: "agent1_0042.jpg", fullPath: "/abs/path/agent1_0042.jpg", publicUrl: "..." }
 */
export function getNextFilename(
  type: "image" | "video" | "audio" | "input",
  extension: string,
  userId?: string
): { filename: string; fullPath: string; publicUrl: string } {
  let directory: string;
  let typeDir: string;

  if (userId) {
    // User-scoped storage
    ensureUserDirectories(userId);
    const userPaths = getUserStoragePaths(userId);
    directory = type === "image" ? userPaths.images
      : type === "video" ? userPaths.videos
      : type === "audio" ? userPaths.audio
      : userPaths.input;
    typeDir = type === "image" ? "images"
      : type === "video" ? "videos"
      : type === "audio" ? "audio"
      : "input";
  } else {
    // Legacy global storage (backward compatibility)
    directory = type === "image" ? STORAGE_PATHS.images
      : type === "video" ? STORAGE_PATHS.videos
      : type === "audio" ? STORAGE_PATHS.audio
      : STORAGE_PATHS.input;
    typeDir = type === "image" ? "images"
      : type === "video" ? "videos"
      : type === "audio" ? "audio"
      : "input";
  }

  const num = getNextProgressiveNumber(directory);
  const padded = String(num).padStart(4, "0");
  const filename = `agent1_${padded}.${extension}`;
  const fullPath = join(directory, filename);

  let publicUrl: string;
  if (userId) {
    // Include user path in public URL
    if (type === "input") {
      publicUrl = `/api/input-images?file=${filename}&userId=${userId}`;
    } else {
      publicUrl = `/api/output-browser?path=users/${userId}/output/${typeDir}/${filename}`;
    }
  } else {
    // Legacy URLs (backward compatibility)
    publicUrl = type === "image" ? `/api/output-browser?path=images/${filename}`
      : type === "video" ? `/api/output-browser?path=videos/${filename}`
      : type === "audio" ? `/api/output-browser?path=audio/${filename}`
      : `/api/input-images?file=${filename}`;
  }

  return { filename, fullPath, publicUrl };
}
