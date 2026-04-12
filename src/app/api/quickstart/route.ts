import fs from "fs/promises";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { buildQuickstartPrompt } from "@/lib/quickstart/prompts";
import { ContentLevel, getPresetTemplate } from "@/lib/quickstart/templates";
import {
  validateWorkflowJSON,
  repairWorkflowJSON,
  parseJSONFromResponse,
} from "@/lib/quickstart/validation";
import { runRAGPipeline } from "@/lib/quickstart/ragPipeline";
import { WorkflowFile } from "@/store/workflowStore";
import { ImageInputNodeData } from "@/types";

export const maxDuration = 60; // 1 minute timeout

/**
 * Convert local image paths (e.g., /sample-images/model.jpg) to base64 data URLs
 */
async function convertLocalImagesToBase64(workflow: WorkflowFile): Promise<WorkflowFile> {
  const updatedNodes = await Promise.all(
    workflow.nodes.map(async (node) => {
      if (node.type === "imageInput") {
        const data = node.data as ImageInputNodeData;
        // Check if image is a local path (starts with /sample-images/)
        if (data.image && data.image.startsWith("/sample-images/")) {
          try {
            // Read file from public folder
            const publicPath = path.join(process.cwd(), "public", data.image);
            const fileBuffer = await fs.readFile(publicPath);
            const base64 = fileBuffer.toString("base64");

            // Determine MIME type from extension
            const ext = path.extname(data.image).toLowerCase();
            const mimeType = ext === ".png" ? "image/png"
              : ext === ".webp" ? "image/webp"
              : "image/jpeg";

            const dataUrl = `data:${mimeType};base64,${base64}`;

            return {
              ...node,
              data: {
                ...data,
                image: dataUrl,
              },
            };
          } catch (error) {
            console.error(`Failed to convert image to base64: ${data.image}`, error);
            // Return node unchanged if conversion fails
            return node;
          }
        }
      }
      return node;
    })
  );

  return {
    ...workflow,
    nodes: updatedNodes,
  };
}

interface QuickstartRequest {
  description: string;
  contentLevel: ContentLevel;
  templateId?: string;
}

interface QuickstartResponse {
  success: boolean;
  workflow?: WorkflowFile;
  error?: string;
}

export async function POST(request: NextRequest) {
  const requestId = `qs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[Quickstart:${requestId}] New request received`);

  try {
    const body: QuickstartRequest = await request.json();
    const { description, contentLevel, templateId } = body;

    console.log(`[Quickstart:${requestId}] Parameters:`, {
      hasDescription: !!description,
      descriptionLength: description?.length || 0,
      contentLevel,
      templateId,
    });

    // If a preset template is selected, return it directly
    if (templateId) {
      console.log(`[Quickstart:${requestId}] Using preset template: ${templateId}`);
      try {
        const workflow = getPresetTemplate(templateId, contentLevel);
        // Convert any local image paths to base64 for the Gemini API
        const workflowWithBase64 = await convertLocalImagesToBase64(workflow);
        console.log(`[Quickstart:${requestId}] Preset template loaded successfully`);
        return NextResponse.json<QuickstartResponse>({
          success: true,
          workflow: workflowWithBase64,
        });
      } catch (error) {
        console.error(`[Quickstart:${requestId}] Preset template error:`, error);
        return NextResponse.json<QuickstartResponse>(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to load template",
          },
          { status: 400 }
        );
      }
    }

    // Validate description
    if (!description || typeof description !== "string" || description.trim().length < 3) {
      console.warn(`[Quickstart:${requestId}] Invalid description`);
      return NextResponse.json<QuickstartResponse>(
        {
          success: false,
          error: "Please provide a description of your workflow (at least 3 characters)",
        },
        { status: 400 }
      );
    }

    // ── Try RAG Pipeline first, fallback to legacy Gemini-only path ──

    let workflow: WorkflowFile;

    try {
      console.log(`[Quickstart:${requestId}] Trying RAG pipeline...`);
      const ragResult = await runRAGPipeline(description.trim(), {
        contentLevel,
        verbose: true,
      });

      workflow = ragResult.workflow;

      console.log(`[Quickstart:${requestId}] RAG pipeline success`, {
        provider: ragResult.metadata.provider,
        model: ragResult.metadata.model,
        totalDuration: ragResult.metadata.totalDuration,
        nodes: workflow.nodes.length,
        edges: workflow.edges.length,
        steps: ragResult.metadata.steps.map(s => `${s.name}: ${s.duration}ms`),
      });
    } catch (ragError) {
      // ── Fallback to legacy Gemini-only path ──
      console.warn(
        `[Quickstart:${requestId}] RAG pipeline failed, falling back to legacy:`,
        ragError instanceof Error ? ragError.message : ragError
      );

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error(`[Quickstart:${requestId}] No GEMINI_API_KEY configured`);
        return NextResponse.json<QuickstartResponse>(
          {
            success: false,
            error: "API key not configured. Add GEMINI_API_KEY to .env.local",
          },
          { status: 500 }
        );
      }

      const prompt = buildQuickstartPrompt(description.trim(), contentLevel);
      console.log(`[Quickstart:${requestId}] Legacy prompt built, length: ${prompt.length}`);

      const ai = new GoogleGenAI({ apiKey });
      const startTime = Date.now();

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 16384,
        },
      });

      const duration = Date.now() - startTime;
      console.log(`[Quickstart:${requestId}] Legacy Gemini response in ${duration}ms`);

      const responseText = response.text;
      if (!responseText) {
        return NextResponse.json<QuickstartResponse>(
          { success: false, error: "No response from AI model" },
          { status: 500 }
        );
      }

      let parsedWorkflow: unknown;
      try {
        parsedWorkflow = parseJSONFromResponse(responseText);
      } catch (parseErr) {
        console.error(`[Quickstart:${requestId}] Legacy JSON parse error:`, parseErr);
        return NextResponse.json<QuickstartResponse>(
          {
            success: false,
            error: "Failed to parse workflow from AI response. Please try again.",
          },
          { status: 500 }
        );
      }

      const validation = validateWorkflowJSON(parsedWorkflow);
      if (!validation.valid) {
        console.log(`[Quickstart:${requestId}] Repairing legacy workflow...`);
        workflow = repairWorkflowJSON(parsedWorkflow);
      } else {
        workflow = parsedWorkflow as WorkflowFile;
      }
    }

    // Ensure the workflow has an ID
    if (!workflow.id) {
      workflow.id = `wf_${Date.now()}_quickstart`;
    }

    console.log(`[Quickstart:${requestId}] Success - nodes: ${workflow.nodes.length}, edges: ${workflow.edges.length}`);

    return NextResponse.json<QuickstartResponse>({
      success: true,
      workflow,
    });
  } catch (error) {
    console.error(`[Quickstart:${requestId}] Unexpected error:`, error);

    // Handle rate limiting
    if (error instanceof Error && error.message.includes("429")) {
      return NextResponse.json<QuickstartResponse>(
        {
          success: false,
          error: "Rate limit reached. Please wait a moment and try again.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json<QuickstartResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate workflow",
      },
      { status: 500 }
    );
  }
}
