import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export function ensureEncryptionSecret(): void {
  if (process.env.ENCRYPTION_SECRET && process.env.ENCRYPTION_SECRET.length >= 32) return;

  const secret = randomBytes(32).toString('hex');
  process.env.ENCRYPTION_SECRET = secret;

  // Append to .env
  const envPath = join(process.cwd(), '.env');
  const content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  if (!content.includes('ENCRYPTION_SECRET')) {
    writeFileSync(envPath, content + `\nENCRYPTION_SECRET=${secret}\n`);
    console.log('[auth] Generated ENCRYPTION_SECRET and saved to .env');
  }
}
