/**
 * Typed error handling for API routes
 *
 * Provides a custom ApiError class and conversion utilities
 * for consistent error responses across routes
 */

import { NextResponse } from "next/server";

/**
 * Custom error class for API errors with status codes
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Detect if an error is a rate limit error
 *
 * Checks error message for common rate limit indicators:
 * - "429" HTTP status code
 * - "rate limit" phrase
 * - "too many requests" phrase
 *
 * @param error The error to check
 * @returns true if error appears to be rate limit related
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("429") ||
      msg.includes("rate limit") ||
      msg.includes("too many requests")
    );
  }
  return false;
}

/**
 * Convert any error to a proper API error response
 *
 * Handles:
 * - ApiError instances: preserves status and code
 * - Error instances: extracts message
 * - Rate limit detection: returns 429 status
 * - Unknown errors: returns 500 with fallback message
 *
 * @param error The error to convert
 * @param fallbackMessage Default message if error can't be extracted
 * @returns NextResponse with appropriate status and error details
 *
 * @example
 * try {
 *   const result = await generateImage();
 * } catch (error) {
 *   return apiErrorResponse(error, "Image generation failed");
 * }
 */
export function apiErrorResponse(
  error: unknown,
  fallbackMessage = "Internal server error"
): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.code && { code: error.code }),
      },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = isRateLimitError(error) ? 429 : 500;

  return NextResponse.json({ error: message }, { status });
}
