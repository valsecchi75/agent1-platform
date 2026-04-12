import { NextRequest, NextResponse } from "next/server";
import type { TemplateRegistry } from "@/types/templates";
import * as fs from "fs";
import * as path from "path";

/**
 * Try to load registry.json from the local agent1-registry folder.
 * Used as fallback when the remote GitHub fetch fails (e.g. during local dev).
 */
function loadLocalRegistry(): TemplateRegistry | null {
  try {
    const localPath = path.resolve(
      process.cwd(),
      "..",
      "agent1-registry",
      "registry.json"
    );
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, "utf-8");
      const registry = JSON.parse(raw) as TemplateRegistry;
      if (registry && Array.isArray(registry.templates)) {
        return registry;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * GET /api/templates/registry?url={registryUrl}
 * Fetch and proxy a remote template registry.
 * Falls back to local agent1-registry/registry.json when the remote fetch fails.
 */
export async function GET(request: NextRequest) {
  try {
    const registryUrl = request.nextUrl.searchParams.get("url");

    if (!registryUrl) {
      return NextResponse.json({
        success: true,
        registry: null,
        message: "No registry URL configured",
      });
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(registryUrl);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid registry URL",
        },
        { status: 400 }
      );
    }

    // Only allow HTTPS for security
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return NextResponse.json(
        {
          success: false,
          error: "Only HTTP/HTTPS URLs are allowed",
        },
        { status: 400 }
      );
    }

    // Fetch the registry with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let registry: TemplateRegistry | null = null;
    let remoteOk = false;

    try {
      const response = await fetch(registryUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Node-Banana-Fork/1.0",
        },
        signal: controller.signal,
      });

      if (response.ok) {
        const data = (await response.json()) as TemplateRegistry;
        if (data && typeof data === "object" && Array.isArray(data.templates)) {
          registry = data;
          remoteOk = true;
        }
      }
    } catch {
      /* remote fetch failed — will try local fallback */
    } finally {
      clearTimeout(timeoutId);
    }

    // Local fallback when remote is unreachable or invalid
    if (!registry) {
      registry = loadLocalRegistry();
      if (registry) {
        console.log(
          "[registry] Remote unavailable — serving local agent1-registry/registry.json"
        );
      }
    }

    if (!registry) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch registry (remote and local fallback both unavailable)",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      registry,
      source: remoteOk ? "remote" : "local-fallback",
    });
  } catch (error) {
    console.error("Error fetching registry:", error);

    // Handle timeout specifically
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        {
          success: false,
          error: "Registry fetch timeout (10 seconds exceeded)",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch registry",
      },
      { status: 500 }
    );
  }
}
