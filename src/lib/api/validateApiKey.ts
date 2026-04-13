/**
 * API key validation utilities
 *
 * Validates that API keys are configured before making provider API calls
 */

import { NextResponse } from "next/server";

/**
 * Validate that an API key is present and non-empty
 *
 * @param apiKey The API key to validate (may be null, undefined, or empty string)
 * @param providerName The name of the provider (for error messages)
 * @returns NextResponse with 401 error if invalid, null if valid
 *
 * @example
 * const validation = validateApiKey(apiKey, "Replicate");
 * if (validation) return validation; // error response
 * // key is valid, continue...
 */
export function validateApiKey(
  apiKey: string | undefined | null,
  providerName: string
): NextResponse | null {
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      {
        error: `${providerName} API key is required. Please configure it in Settings.`,
      },
      { status: 401 }
    );
  }
  return null; // valid
}
