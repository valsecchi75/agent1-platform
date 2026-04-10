import { getUserApiKey } from '@/lib/db';

export class ApiKeyError extends Error {
  keyName: string;
  constructor(keyName: string) {
    super(`API key not configured: ${keyName}. Add it in Settings > API Keys.`);
    this.name = 'ApiKeyError';
    this.keyName = keyName;
  }
}

export function resolveApiKey(userId: string, keyName: string): string {
  const key = getUserApiKey(userId, keyName);
  if (!key) {
    throw new ApiKeyError(keyName);
  }
  return key;
}
