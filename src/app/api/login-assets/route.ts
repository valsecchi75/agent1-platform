import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const AUDIO_EXTS = new Set([".mp3", ".ogg", ".wav", ".m4a"]);

function listFiles(dir: string, extensions: Set<string>): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => {
        // Skip dotfiles, depth maps, url shortcuts
        if (f.startsWith(".")) return false;
        if (f.toLowerCase().includes("depth")) return false;
        if (f.toLowerCase().endsWith(".url")) return false;
        return extensions.has(path.extname(f).toLowerCase());
      })
      .sort((a, b) => {
        // Natural numeric sort: 1.jpg, 2.jpg, ... 10.jpg
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });
  } catch {
    return [];
  }
}

/**
 * Resolve the public/login directory.
 * Try multiple strategies because process.cwd() can vary depending on
 * how Next.js is launched (from app/ vs project root).
 */
function resolvePublicLogin(): string {
  const candidates = [
    // Standard: process.cwd() is the app/ directory
    path.join(process.cwd(), "public", "login"),
    // If cwd is the project root (one level up from app/)
    path.join(process.cwd(), "app", "public", "login"),
    // Relative to this file's compiled location (App Router: .next/server/app/api/login-assets)
    path.resolve(__dirname, "..", "..", "..", "..", "..", "public", "login"),
    path.resolve(__dirname, "..", "..", "..", "..", "..", "..", "public", "login"),
  ];

  for (const candidate of candidates) {
    const bgDir = path.join(candidate, "backgrounds");
    if (fs.existsSync(bgDir)) {
      return candidate;
    }
  }

  // Fallback to standard
  return candidates[0];
}

export async function GET() {
  const publicLogin = resolvePublicLogin();

  const backgrounds = listFiles(path.join(publicLogin, "backgrounds"), IMAGE_EXTS);
  const music = listFiles(path.join(publicLogin, "music"), AUDIO_EXTS);
  const sounds = listFiles(path.join(publicLogin, "sounds"), AUDIO_EXTS);

  return NextResponse.json({
    backgrounds,
    music,
    sounds,
    // Debug info — remove in production
    _debug: {
      cwd: process.cwd(),
      resolvedPath: publicLogin,
      bgExists: fs.existsSync(path.join(publicLogin, "backgrounds")),
      bgCount: backgrounds.length,
    },
  });
}
