/**
 * LLM Provider Abstraction Layer
 *
 * Provides a unified interface for communicating with multiple LLM providers
 * (Gemini, Anthropic, OpenAI). This allows the AGENT 1 RAG pipeline to work
 * with any provider the user has configured, without hardcoding API logic.
 *
 * Each provider:
 * - Checks for a valid API key (env var or settings)
 * - Implements a standard call() interface
 * - Returns normalized LLMResponse objects
 * - Logs which model it's using
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "@/utils/logger";

/**
 * Configuration options for LLM calls
 */
export interface LLMCallOptions {
  /** Temperature for generation (0.0 to 1.0+). Higher = more creative, lower = more focused. */
  temperature?: number;
  /** Maximum number of output tokens to generate */
  maxOutputTokens?: number;
  /** Request JSON output format if supported by the provider */
  jsonMode?: boolean;
}

/**
 * Normalized response from any LLM provider
 */
export interface LLMResponse {
  /** The generated text content */
  text: string;
  /** Which provider generated this (e.g., "gemini", "anthropic", "openai") */
  provider: string;
  /** The specific model used (e.g., "gemini-2.5-flash-preview-05-20") */
  model: string;
  /** Approximate tokens used (if available from the provider) */
  tokensUsed?: number;
}

/**
 * Base interface that all LLM provider implementations must satisfy
 */
export interface LLMProvider {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;

  /**
   * Check if this provider is available (has valid API key)
   */
  isAvailable(): boolean;

  /**
   * Call the LLM with a prompt
   * @param prompt The user prompt/query
   * @param systemPrompt Optional system message to guide behavior
   * @param options Optional call configuration
   * @returns Normalized LLM response
   * @throws Error if the call fails or provider is not configured
   */
  call(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCallOptions
  ): Promise<LLMResponse>;
}

/**
 * Gemini provider using @google/genai SDK
 * Models: gemini-2.5-flash-preview-05-20 (fast) or gemini-2.5-pro-preview-05-06 (quality)
 */
class GeminiProvider implements LLMProvider {
  id = "gemini";
  name = "Google Gemini";
  private model = "gemini-2.5-flash-preview-05-20"; // Speed-optimized for RAG

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  async call(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY not configured. Set it in .env.local or configure in Settings."
      );
    }

    const temperature = options?.temperature ?? 0.7;
    const maxOutputTokens = options?.maxOutputTokens ?? 1024;

    logger.info("api.llm", "Calling Gemini API", {
      provider: this.id,
      model: this.model,
      temperature,
      maxOutputTokens,
      hasSystemPrompt: !!systemPrompt,
      promptLength: prompt.length,
    });

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Build messages with optional system prompt
      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];
      if (systemPrompt) {
        messages.push({
          role: "user",
          content: systemPrompt,
        });
        messages.push({
          role: "assistant",
          content: "Understood. I will follow these instructions.",
        });
      }
      messages.push({
        role: "user",
        content: prompt,
      });

      // Make the API call
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: this.model,
        contents: messages.map((msg) => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        })),
        config: {
          temperature,
          maxOutputTokens,
        },
      });
      const duration = Date.now() - startTime;

      // Extract text from response
      const text = response.text;
      if (!text) {
        throw new Error("No text content in Gemini response");
      }

      logger.info("api.llm", "Gemini API response received", {
        provider: this.id,
        duration,
        responseLength: text.length,
      });

      return {
        text,
        provider: this.id,
        model: this.model,
      };
    } catch (error) {
      logger.error(
        "api.error",
        "Gemini API call failed",
        { provider: this.id },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }
}

/**
 * Anthropic provider using REST API (fetch)
 * Model: claude-sonnet-4-20250514
 */
class AnthropicProvider implements LLMProvider {
  id = "anthropic";
  name = "Anthropic Claude";
  private model = "claude-sonnet-4-20250514";

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async call(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY not configured. Set it in .env.local or configure in Settings."
      );
    }

    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxOutputTokens ?? 1024;

    logger.info("api.llm", "Calling Anthropic API", {
      provider: this.id,
      model: this.model,
      temperature,
      maxTokens,
      hasSystemPrompt: !!systemPrompt,
      promptLength: prompt.length,
    });

    try {
      const startTime = Date.now();
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message ||
          `Anthropic API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;

      if (!text) {
        throw new Error("No text content in Anthropic response");
      }

      logger.info("api.llm", "Anthropic API response received", {
        provider: this.id,
        duration,
        responseLength: text.length,
        tokensUsed: data.usage?.output_tokens,
      });

      return {
        text,
        provider: this.id,
        model: this.model,
        tokensUsed: data.usage?.output_tokens,
      };
    } catch (error) {
      logger.error(
        "api.error",
        "Anthropic API call failed",
        { provider: this.id },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }
}

/**
 * OpenAI provider using REST API (fetch)
 * Model: gpt-4o
 */
class OpenAIProvider implements LLMProvider {
  id = "openai";
  name = "OpenAI GPT-4";
  private model = "gpt-4o";

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async call(
    prompt: string,
    systemPrompt?: string,
    options?: LLMCallOptions
  ): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY not configured. Set it in .env.local or configure in Settings."
      );
    }

    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxOutputTokens ?? 1024;

    logger.info("api.llm", "Calling OpenAI API", {
      provider: this.id,
      model: this.model,
      temperature,
      maxTokens,
      hasSystemPrompt: !!systemPrompt,
      promptLength: prompt.length,
    });

    try {
      const messages: Array<{
        role: "system" | "user";
        content: string;
      }> = [];

      if (systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: prompt,
      });

      const startTime = Date.now();
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        }
      );
      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error?.message || `OpenAI API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        throw new Error("No text content in OpenAI response");
      }

      logger.info("api.llm", "OpenAI API response received", {
        provider: this.id,
        duration,
        responseLength: text.length,
        tokensUsed: data.usage?.completion_tokens,
      });

      return {
        text,
        provider: this.id,
        model: this.model,
        tokensUsed: data.usage?.completion_tokens,
      };
    } catch (error) {
      logger.error(
        "api.error",
        "OpenAI API call failed",
        { provider: this.id },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }
}

// Singleton provider instances
const providers: LLMProvider[] = [
  new GeminiProvider(),
  new AnthropicProvider(),
  new OpenAIProvider(),
];

/**
 * Get a single available provider
 *
 * Priority order:
 * 1. If preferredId is specified and available, use it
 * 2. Otherwise, use first available in order: gemini → anthropic → openai
 *
 * @param preferredId Optional provider ID to prefer
 * @returns The selected provider, or null if none are available
 */
export function getAvailableProvider(preferredId?: string): LLMProvider | null {
  // If a preferred provider is requested, try to use it
  if (preferredId) {
    const preferred = providers.find((p) => p.id === preferredId);
    if (preferred?.isAvailable()) {
      logger.info("api.llm", "Using preferred LLM provider", {
        provider: preferred.id,
      });
      return preferred;
    }
  }

  // Fall back to first available provider
  for (const provider of providers) {
    if (provider.isAvailable()) {
      logger.info("api.llm", "Using available LLM provider", {
        provider: provider.id,
      });
      return provider;
    }
  }

  logger.warn("api.llm", "No LLM providers available");
  return null;
}

/**
 * Get all available providers
 *
 * @returns Array of all configured LLM providers (in order: gemini, anthropic, openai)
 */
export function getAllProviders(): LLMProvider[] {
  return providers;
}
