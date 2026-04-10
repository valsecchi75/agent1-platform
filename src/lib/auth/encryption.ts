import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;

function deriveKey(userId: string): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be set in .env (minimum 32 characters)');
  }
  return pbkdf2Sync(secret, userId, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptValue(plaintext: string, userId: string): EncryptedValue {
  const key = deriveKey(userId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { ciphertext: encrypted, iv: iv.toString('hex'), authTag };
}

export function decryptValue(ciphertext: string, iv: string, authTag: string, userId: string): string {
  const key = deriveKey(userId);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function maskApiKey(value: string): string {
  if (!value) return '***';
  const last4 = value.slice(-Math.min(4, value.length));
  return `...${last4}`;
}
