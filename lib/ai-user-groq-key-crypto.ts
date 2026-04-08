import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const SALT = 'focusflow-ai-user-key-v1';
const ALGO = 'aes-256-gcm';

function isPlausibleServerGeminiKey(raw: string): boolean {
  const k = raw.trim();
  return (
    k.length >= 30 &&
    k.startsWith('AIza') &&
    !k.includes('PASTE_YOUR_KEY_HERE') &&
    !k.toLowerCase().includes('your_')
  );
}

/**
 * Prefer a dedicated secret; if missing, derive from server GEMINI_API_KEY so BYOK works on single-key deploys.
 * Rotating GEMINI_API_KEY without AI_USER_KEY_ENCRYPTION_SECRET will invalidate stored user keys until they re-save.
 */
function deriveKey(): Buffer {
  const dedicated = process.env.AI_USER_KEY_ENCRYPTION_SECRET?.trim();
  if (dedicated && dedicated.length >= 16) {
    return scryptSync(dedicated, SALT, 32);
  }

  const gemini = process.env.GEMINI_API_KEY?.trim() || '';
  if (isPlausibleServerGeminiKey(gemini)) {
    return scryptSync(`focusflow-user-cred-wrap|${gemini}`, SALT, 32);
  }

  throw new Error(
    'Could not save your key securely. Add AI_USER_KEY_ENCRYPTION_SECRET (any random string, 16+ characters) to the server environment and restart — this is not your Gemini key; it only encrypts saved keys. Alternatively set a valid GEMINI_API_KEY on the server.'
  );
}

/** Google Gemini / Generative Language API keys start with `AIza`. */
export function isValidUserGeminiApiKeyFormat(key: string): boolean {
  const k = key.trim();
  return k.startsWith('AIza') && k.length >= 30;
}

/** @deprecated Legacy Groq keys; BYOK is Gemini-only now. */
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
