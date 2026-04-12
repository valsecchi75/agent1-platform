/**
 * Parses .releaseinclude whitelist format.
 * - One entry per line
 * - Lines starting with # are comments
 * - Trailing / indicates a directory (include all contents recursively)
 * - No glob patterns — simple prefix matching
 */

export interface WhitelistEntry {
  path: string;
  isDirectory: boolean;
}

export function parseWhitelist(content: string): WhitelistEntry[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .map(line => ({
      path: line.endsWith('/') ? line.slice(0, -1) : line,
      isDirectory: line.endsWith('/'),
    }));
}

export function shouldInclude(
  filePath: string,
  whitelist: WhitelistEntry[]
): boolean {
  // Normalize: remove leading ./ or /
  const normalized = filePath.replace(/^\.?\//, '');
  return whitelist.some(entry =>
    entry.isDirectory
      ? normalized.startsWith(entry.path + '/') || normalized === entry.path
      : normalized === entry.path
  );
}
