#!/usr/bin/env node
// encode-token.js — XOR + base64 obfuscation for GitHub PAT
// Usage: node encode-token.js <github_token>

const crypto = require('crypto');

const SALT = 'agent1-from-vision-to-form::agent1-update-salt::2026';

function deriveKey(salt) {
  return crypto.createHash('sha256').update(salt).digest();
}

function xorEncode(token, key) {
  const tokenBytes = Buffer.from(token, 'utf-8');
  const encoded = Buffer.alloc(tokenBytes.length);
  for (let i = 0; i < tokenBytes.length; i++) {
    encoded[i] = tokenBytes[i] ^ key[i % key.length];
  }
  return encoded.toString('base64');
}

function xorDecode(encoded, key) {
  const bytes = Buffer.from(encoded, 'base64');
  const decoded = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    decoded[i] = bytes[i] ^ key[i % key.length];
  }
  return decoded.toString('utf-8');
}

// Main
const token = process.argv[2];
if (!token) {
  console.error('Usage: node encode-token.js <github_token>');
  console.error('Example: node encode-token.js ghp_xxxxxxxxxxxxxxxxxxxx');
  process.exit(1);
}

const key = deriveKey(SALT);
const encoded = xorEncode(token, key);

// Verify round-trip
const decoded = xorDecode(encoded, key);
if (decoded !== token) {
  console.error('ERROR: Round-trip verification failed!');
  process.exit(1);
}

console.log('');
console.log('=== AGENT 1 Token Encoder ===');
console.log('');
console.log('Obfuscated token (paste into src/lib/update/token.ts):');
console.log('');
console.log(`const OBFUSCATED_TOKEN = '${encoded}';`);
console.log('');
console.log('Verification: decode matches original ✓');
console.log('');
