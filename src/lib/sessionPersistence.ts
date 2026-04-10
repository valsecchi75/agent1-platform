/**
 * Server-side Session Persistence
 *
 * Saves/loads workflow tab snapshots to disk with image extraction.
 * Base64 images are extracted to separate files and replaced with
 * "session-ref:{filename}" references. On load, refs are hydrated
 * back to base64 data URLs.
 *
 * Storage layout:
 *   storage/users/{userId}/workflows/__session/
 *     tab_{id}.json           — workflow snapshot per tab (no base64)
 *     images/{hash}.{ext}     — extracted images (deduplicated by content hash)
 */

import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";

const STORAGE_DIR = path.resolve(process.cwd(), "storage");

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSessionDir(userId: string): string {
  return path.join(STORAGE_DIR, "users", userId, "workflows", "__session");
}

function getSessionImagesDir(userId: string): string {
  return path.join(getSessionDir(userId), "images");
}

function ensureSessionDirs(userId: string): void {
  const sessionDir = getSessionDir(userId);
  const imagesDir = getSessionImagesDir(userId);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
}

function isBase64DataUrl(str: unknown): str is string {
  return typeof str === "string" && str.startsWith("data:");
}

function extractBase64(dataUrl: string): { buffer: Buffer; ext: string; mime: string } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,/);
  const mime = match ? match[1] : "image/png";
  const ext = match
    ? (match[1] === "image/jpeg" ? "jpg" : match[1].replace("image/", ""))
    : "png";
  const raw = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return { buffer: Buffer.from(raw, "base64"), ext, mime };
}

/**
 * Save a base64 image to session images directory.
 * Returns a session reference string: "session-ref:{filename}"
 * Deduplicates by MD5 content hash.
 */
function saveSessionImage(dataUrl: string, userId: string): string {
  const { buffer, ext } = extractBase64(dataUrl);
  const hash = crypto.createHash("md5").update(buffer).digest("hex");
  const filename = `${hash}.${ext}`;
  const filePath = path.join(getSessionImagesDir(userId), filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, buffer);
  }
  return `session-ref:${filename}`;
}

/**
 * Load a session image reference back to a base64 data URL.
 * Returns null if the file doesn't exist.
 */
function loadSessionImage(ref: string, userId: string): string | null {
  if (!ref || !ref.startsWith("session-ref:")) return null;
  const filename = ref.slice("session-ref:".length);
  const filePath = path.join(getSessionImagesDir(userId), filename);
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).slice(1);
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

// ─── Node Data Processing ───────────────────────────────────────────────────

/**
 * Externalize images from a node's data object.
 * Replaces base64 data URLs with session-ref strings.
 * Adds `_session*Ref` fields for each extracted image.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function externalizeNodeData(data: any, userId: string): any {
  if (!data) return data;
  const d = { ...data };

  // ── Single image fields ──────────────────────────────
  if (isBase64DataUrl(d.image)) {
    d._sessionImageRef = saveSessionImage(d.image, userId);
    d.image = null;
  }
  if (isBase64DataUrl(d.sourceImage)) {
    d._sessionSourceImageRef = saveSessionImage(d.sourceImage, userId);
    d.sourceImage = null;
  }
  if (isBase64DataUrl(d.outputImage)) {
    d._sessionOutputImageRef = saveSessionImage(d.outputImage, userId);
    d.outputImage = null;
  }

  // ── inputImages array ────────────────────────────────
  if (Array.isArray(d.inputImages)) {
    const refs: string[] = d._sessionInputImageRefs
      ? [...d._sessionInputImageRefs]
      : [];
    d.inputImages = d.inputImages.map((img: unknown, i: number) => {
      if (isBase64DataUrl(img)) {
        refs[i] = saveSessionImage(img, userId);
        return null;
      }
      return img;
    });
    if (refs.some(Boolean)) {
      d._sessionInputImageRefs = refs;
    }
  }

  // ── imageHistory array (nanoBanana) ──────────────────
  if (Array.isArray(d.imageHistory)) {
    d.imageHistory = d.imageHistory.map((item: Record<string, unknown>) => {
      if (item && isBase64DataUrl(item.base64)) {
        return {
          ...item,
          _sessionBase64Ref: saveSessionImage(item.base64 as string, userId),
          base64: null,
        };
      }
      return item;
    });
  }

  // ── outputGallery array (output node) ────────────────
  if (Array.isArray(d.outputGallery)) {
    d.outputGallery = d.outputGallery.map((img: unknown) => {
      if (isBase64DataUrl(img)) {
        return saveSessionImage(img, userId);
      }
      return img;
    });
  }

  return d;
}

/**
 * Hydrate a node's data object by loading session-ref images.
 * Replaces session-ref strings with base64 data URLs.
 * Also loads images from storagePath if available but image is null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hydrateNodeData(data: any, userId: string): any {
  if (!data) return data;
  const d = { ...data };

  // ── Single image fields ──────────────────────────────
  if (d._sessionImageRef) {
    d.image = loadSessionImage(d._sessionImageRef, userId) || d.image;
    delete d._sessionImageRef;
  }

  // Fallback: load from storagePath if image is still null (ImageInputNode)
  if (!d.image && d.storagePath && typeof d.storagePath === "string") {
    try {
      if (fs.existsSync(d.storagePath)) {
        const buffer = fs.readFileSync(d.storagePath);
        const ext = path.extname(d.storagePath).slice(1).toLowerCase();
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext || "png"}`;
        d.image = `data:${mime};base64,${buffer.toString("base64")}`;
      }
    } catch { /* ignore - file may have been deleted */ }
  }
  if (d._sessionSourceImageRef) {
    d.sourceImage = loadSessionImage(d._sessionSourceImageRef, userId) || d.sourceImage;
    delete d._sessionSourceImageRef;
  }
  if (d._sessionOutputImageRef) {
    d.outputImage = loadSessionImage(d._sessionOutputImageRef, userId) || d.outputImage;
    delete d._sessionOutputImageRef;
  }

  // ── inputImages array ────────────────────────────────
  if (Array.isArray(d._sessionInputImageRefs)) {
    if (!Array.isArray(d.inputImages)) d.inputImages = [];
    d._sessionInputImageRefs.forEach((ref: string, i: number) => {
      if (ref) {
        const img = loadSessionImage(ref, userId);
        if (img) d.inputImages[i] = img;
      }
    });
    delete d._sessionInputImageRefs;
  }

  // ── imageHistory array ───────────────────────────────
  if (Array.isArray(d.imageHistory)) {
    d.imageHistory = d.imageHistory.map((item: Record<string, unknown>) => {
      if (item && item._sessionBase64Ref) {
        const base64 = loadSessionImage(item._sessionBase64Ref as string, userId);
        const result: Record<string, unknown> = { ...item, base64: base64 || item.base64 };
        delete result._sessionBase64Ref;
        return result;
      }
      return item;
    });
  }

  // ── outputGallery array ──────────────────────────────
  if (Array.isArray(d.outputGallery)) {
    d.outputGallery = d.outputGallery.map((entry: unknown) => {
      if (typeof entry === "string" && entry.startsWith("session-ref:")) {
        return loadSessionImage(entry, userId) || entry;
      }
      return entry;
    });
  }

  return d;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Externalize all nodes in a snapshot object (strip base64, write images).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function externalizeSnapshot(snapshot: any, userId: string): any {
  if (!snapshot || !Array.isArray(snapshot.nodes)) return snapshot;
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((node: Record<string, unknown>) => ({
      ...node,
      data: externalizeNodeData(node.data, userId),
    })),
  };
}

/**
 * Hydrate all nodes in a snapshot object (inject base64 from disk).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hydrateSnapshot(snapshot: any, userId: string): any {
  if (!snapshot || !Array.isArray(snapshot.nodes)) return snapshot;
  return {
    ...snapshot,
    nodes: snapshot.nodes.map((node: Record<string, unknown>) => ({
      ...node,
      data: hydrateNodeData(node.data, userId),
    })),
  };
}

/**
 * Save a tab's workflow snapshot to a session file.
 * Returns the file path.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveSessionWorkflow(userId: string, tabId: string, snapshot: any): string {
  ensureSessionDirs(userId);
  const cleanedSnapshot = externalizeSnapshot(snapshot, userId);
  const safeId = tabId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `tab_${safeId}.json`;
  const filePath = path.join(getSessionDir(userId), filename);
  fs.writeFileSync(filePath, JSON.stringify(cleanedSnapshot));
  return filePath;
}

/**
 * Load a tab's workflow snapshot from a session file.
 * Returns the hydrated snapshot, or null if file not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadSessionWorkflow(userId: string, tabId: string): any | null {
  const safeId = tabId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `tab_${safeId}.json`;
  const filePath = path.join(getSessionDir(userId), filename);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return hydrateSnapshot(raw, userId);
  } catch {
    return null;
  }
}

/**
 * Save the "last generation" workflow snapshot for the "Last Workflow" button.
 * This is called by agent1-save when a generation completes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveLastGenerationWorkflow(userId: string, snapshot: any): string {
  ensureSessionDirs(userId);
  const cleanedSnapshot = externalizeSnapshot(snapshot, userId);
  const filePath = path.join(getSessionDir(userId), "last_generation.json");
  fs.writeFileSync(filePath, JSON.stringify(cleanedSnapshot));
  return filePath;
}

/**
 * Load the "last generation" workflow snapshot.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadLastGenerationWorkflow(userId: string): any | null {
  const filePath = path.join(getSessionDir(userId), "last_generation.json");
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return hydrateSnapshot(raw, userId);
  } catch {
    return null;
  }
}

/**
 * Clean up old session files that no longer correspond to open tabs.
 */
export function cleanupOldSessionFiles(userId: string, validTabIds: string[]): void {
  ensureSessionDirs(userId);
  const validFiles = new Set(
    validTabIds.map((id) => `tab_${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`)
  );
  // Always keep last_generation.json
  validFiles.add("last_generation.json");

  try {
    const sessionDir = getSessionDir(userId);
    const files = fs.readdirSync(sessionDir);
    for (const file of files) {
      if (file.endsWith(".json") && !validFiles.has(file)) {
        fs.unlinkSync(path.join(sessionDir, file));
      }
    }
  } catch {
    /* ignore cleanup errors */
  }
}
