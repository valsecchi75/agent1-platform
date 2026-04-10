import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from 'ai';
import { NextRequest } from 'next/server';
import { buildWorkflowContext } from '@/lib/chat/contextBuilder';
import { extractSubgraph } from '@/lib/chat/subgraphExtractor';
import { createChatTools, buildEditSystemPrompt } from '@/lib/chat/tools';
import { WorkflowNode } from '@/types';
import { WorkflowEdge } from '@/types/workflow';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { resolveApiKey, ApiKeyError } from '@/lib/auth/resolveApiKey';

export const maxDuration = 60; // 1 minute timeout

export async function POST(request: Request) {
  try {
    // Cast to NextRequest for cookie access (getRequestUser needs cookies)
    const nextReq = request as unknown as NextRequest;
    const user = await getRequestUser(nextReq);

    const { messages, workflowState, selectedNodeIds } = await request.json() as {
      messages: UIMessage[];
      workflowState?: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
      selectedNodeIds?: string[];
    };

    // Get API key from per-user storage, with header fallback for backward compatibility
    const headerKey = (request.headers as any)?.get?.("X-Gemini-API-Key");
    const apiKey = headerKey || resolveApiKey(user.userId, 'GEMINI_API_KEY');
    if (!apiKey) {
      return new Response('GEMINI_API_KEY not configured', { status: 403 });
    }

    // Extract subgraph if nodes are selected, otherwise use full workflow
    const subgraph = extractSubgraph(
      workflowState?.nodes || [],
      workflowState?.edges || [],
      selectedNodeIds || []
    );

    // Build workflow context from selected subgraph
    const context = buildWorkflowContext(
      subgraph.selectedNodes,
      subgraph.selectedEdges
    );

    // Build context-aware system prompt with optional rest summary
    const systemPrompt = buildEditSystemPrompt(context, subgraph.restSummary);

    // Extract node IDs for tool validation
    const nodeIds = (workflowState?.nodes || []).map(n => n.id);

    // Create chat tools with current workflow context
    const tools = createChatTools(nodeIds);

    // Create Google provider with API key
    const google = createGoogleGenerativeAI({ apiKey });

    // Convert UI messages to model messages format
    const modelMessages = await convertToModelMessages(messages);

    // Create streaming response with tool calling
    const result = streamText({
      model: google('gemini-3-flash'),
      system: systemPrompt,
      messages: modelMessages,
      tools: tools,
      toolChoice: 'auto', // Let LLM decide which tool to use
      stopWhen: stepCountIs(3), // Allow multi-step reasoning for complex requests
    });

    // Return the UI message stream response for useChat compatibility
    return result.toUIMessageStreamResponse();
  } catch (error) {
    // Handle authentication errors
    if (error instanceof AuthError) {
      return new Response(error.message, { status: error.status });
    }

    // Handle API key resolution errors
    if (error instanceof ApiKeyError) {
      return new Response(`API key not configured: ${error.keyName}. Add it in Settings > API Keys.`, { status: 403 });
    }

    console.error('[Chat API Error]', error);

    if (error instanceof Error && error.message.includes('429')) {
      return new Response('Rate limit reached. Please wait and try again.', { status: 429 });
    }

    // Check for token/size errors and return 413
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('too large') || errorMsg.includes('token limit') || errorMsg.includes('payload') || errorMsg.includes('request entity too large')) {
        return new Response('This workflow is too large for the AI to process. Try selecting fewer nodes.', { status: 413 });
      }
    }

    return new Response(
      error instanceof Error ? error.message : 'Chat request failed',
      { status: 500 }
    );
  }
}
