import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const SALT = 'focusflow-ai-user-key-v1';
const ALGO = 'aes-256-gcm';

function deriveKey(): Buffer {
  const secret = process.env.AI_USER_KEY_ENCRYPTION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error('Server misconfigured: AI_USER_KEY_ENCRYPTION_SECRET (min 16 chars) is required to store user Groq keys.');
  }
  return scryptSync(secret, SALT, 32);
}

export function isValidGroqKeyFormat(key: string): boolean {
  const k = key.trim();
  return k.startsWith('gsk_') && k.length > 20;
}

/** Returns base64 ciphertext (iv + tag + payload). */
export function encryptUserGroqKey(plainKey: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plainKey.trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptUserGroqKey(ciphertextB64: string): string {
  const key = deriveKey();
  const buf = Buffer.from(ciphertextB64, 'base64');
  if (buf.length < 12 + 16 + 1) throw new Error('Invalid credential blob');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
