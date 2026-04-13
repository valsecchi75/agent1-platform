import { NextRequest, NextResponse } from "next/server";
import type { TemplatePack } from "@/types/templates";
import { installRemoteTemplate } from "@/lib/templateStorage";
import * as fs from "fs";
import * as pathMod from "path";

/**
 * POST /api/templates/install
 * Install a template from a remote registry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      registryBaseUrl,
      slug,
      templatePath,
      previewFrames,
    } = body as {
      registryBaseUrl: string;
      slug: string;
      templatePath: string;
      previewFrames?: string[];
    };

    // Validate required fields
    if (!registryBaseUrl || !slug || !templatePath) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate URLs
    let baseUrl: URL;
    try {
      baseUrl = new URL(registryBaseUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid registry base URL",
        },
        { status: 400 }
      );
    }

    // Only allow HTTPS/HTTP
    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
      return NextResponse.json(
        {
          success: false,
          error: "Only HTTP/HTTPS URLs are allowed",
        },
        { status: 400 }
      );
    }

    // Fetch template JSON (remote first, local fallback)
    let template: TemplatePack | null = null;
    const templateUrl = new URL(templatePath, registryBaseUrl).toString();

    try {
      const templateResponse = await fetchWithTimeout(templateUrl, 10000);
      if (templateResponse.ok) {
        template = (await templateResponse.json()) as TemplatePack;
      }
    } catch {
      /* remote failed — will try local fallback */
    }

    // Local fallback: read from agent1-registry folder
    if (!template) {
      try {
        const localPath = pathMod.resolve(
          process.cwd(),
          "..",
          "agent1-registry",
          templatePath
        );
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, "utf-8");
          template = JSON.parse(raw) as TemplatePack;
          console.log(
            `[install] Remote unavailable — loaded template from local: ${localPath}`
          );
        }
      } catch {
        /* local fallback also failed */
      }
    }

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch template (remote and local fallback both unavailable)",
        },
        { status: 502 }
      );
    }

    // Validate template structure
    if (
      !template ||
      !template.nodes ||
      !template.edges ||
      typeof template.name !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid template format",
        },
        { status: 400 }
      );
    }

    // Fetch preview images if provided (remote first, local fallback)
    let decodedImages: Array<{ filename: string; buffer: Buffer }> | undefined;
    if (previewFrames && previewFrames.length > 0) {
      decodedImages = [];

      for (const frame of previewFrames) {
        const previewUrl = new URL(
          `templates/${slug}/preview/${frame}`,
          registryBaseUrl
        ).toString();
        let fetched = false;

        try {
          const previewResponse = await fetchWithTimeout(previewUrl, 5000);
          if (previewResponse.ok) {
            const buffer = await previewResponse.arrayBuffer();
            decodedImages.push({
              filename: sanitizeFilename(frame),
              buffer: Buffer.from(buffer),
            });
            fetched = true;
          }
        } catch {
          /* remote failed */
        }

        // Local fallback for preview images
        if (!fetched) {
          try {
            const localPreview = pathMod.resolve(
              process.cwd(),
              "..",
              "agent1-registry",
              "templates",
              slug,
              "preview",
              frame
            );
            if (fs.existsSync(localPreview)) {
              const buffer = fs.readFileSync(localPreview);
              decodedImages.push({
                filename: sanitizeFilename(frame),
                buffer,
              });
            }
          } catch {
            console.warn(`Warning: Failed to load local preview ${frame}`);
          }
        }
      }
    }

    // Install template
    installRemoteTemplate(
      slug,
      template,
      decodedImages || [],
      registryBaseUrl,
      template.registryVersion || "1.0.0"
    );

    return NextResponse.json({
      success: true,
      slug,
    });
  } catch (error) {
    console.error("Error installing template:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to install template",
      },
      { status: 500 }
    );
  }
}

/**
 * Helper to fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Node-Banana-Fork/1.0",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
