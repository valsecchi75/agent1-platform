import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { TextEncoder } from 'util';
import * as jose from 'jose';

const ENV_PATH = resolve(process.cwd(), '.env');

function getOrCreateSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length > 0) {
    console.warn('JWT_SECRET too short (< 32 chars), generating new one');
  }

  const secret = randomBytes(32).toString('hex');

  try {
    if (existsSync(ENV_PATH)) {
      let content = readFileSync(ENV_PATH, 'utf-8');
      if (content.includes('JWT_SECRET=')) {
        content = content.replace(/JWT_SECRET=.*/, `JWT_SECRET=${secret}`);
      } else {
        content += `\nJWT_SECRET=${secret}\n`;
      }
      writeFileSync(ENV_PATH, content, { mode: 0o600 });
    }
  } catch {
    // If we can't write, just use in-memory
  }

  process.env.JWT_SECRET = secret;
  return secret;
}

function getSecretKey(): Uint8Array {
  const secret = getOrCreateSecret();
  const encoded = new TextEncoder().encode(secret);
  return new Uint8Array(encoded);
}

export async function signToken(
  payload: Record<string, unknown>,
  expiresIn: string = '7d'
): Promise<string> {
  const secret = getSecretKey();
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
