/**
 * Data URL parsing utilities
 *
 * Extracts MIME type and base64 data from data URLs
 * Handles edge cases: missing headers, different regex patterns, raw data
 */

export interface ParsedDataUrl {
  mimeType: string;
  base64: string;
  buffer: Buffer;
}

/**
 * Parse a data URL and extract MIME type and base64 data
 *
 * Handles multiple patterns:
 * - Standard: data:image/png;base64,ABC123...
 * - Short MIME: data:png;base64,ABC123...
 * - Raw base64: ABC123... (returns image/png by default)
 * - Non-data URL: returns as-is (for already-uploaded URLs)
 *
 * @param dataUrl Data URL or base64 string
 * @returns Parsed data with mimeType, base64 string, and Buffer
 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  let mimeType = "image/png"; // default fallback
  let base64Data = dataUrl;

  // If it starts with "data:", parse the header
  if (dataUrl.startsWith("data:")) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    } else {
      // Try alternative pattern with .+? (non-greedy)
      const altMatch = dataUrl.match(/^data:(.+?);base64,(.+)$/);
      if (altMatch) {
        mimeType = altMatch[1];
        base64Data = altMatch[2];
      }
    }
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, "base64");

  return {
    mimeType,
    base64: base64Data,
    buffer,
  };
}

/**
 * Check if a string is a data URL
 */
export function isDataUrl(str: string): boolean {
  return str.startsWith("data:");
}
