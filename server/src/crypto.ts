import { randomBytes, createCipheriv, createDecipheriv, scryptSync, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;

// Derive key once per passphrase and cache it for the session.
// Uses a deterministic salt derived from the passphrase itself.
// Security comes from the random IV per encryption, not the salt.
let cachedKey: { passphrase: string; key: Buffer } | null = null;

function getKey(passphrase: string): Buffer {
  if (cachedKey && cachedKey.passphrase === passphrase) {
    return cachedKey.key;
  }
  const salt = createHash("sha256").update(passphrase).digest();
  const key = scryptSync(passphrase, salt, KEY_LEN) as Buffer;
  cachedKey = { passphrase, key };
  return key;
}

export function clearKeyCache() {
  cachedKey = null;
}

// New format: iv || tag || ciphertext (no salt, since it's derived from passphrase)
export function encrypt(plaintext: string, passphrase: string): string {
  const iv = randomBytes(IV_LEN);
  const key = getKey(passphrase);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

// Supports both old format (salt || iv || tag || ciphertext) and new format (iv || tag || ciphertext)
export function decrypt(encoded: string, passphrase: string): string {
  const data = Buffer.from(encoded, "base64");
  const key = getKey(passphrase);

  // Old format had 32-byte salt prefix, new format starts with 16-byte IV.
  // Try new format first (shorter), fall back to old format.
  try {
    const iv = data.subarray(0, IV_LEN);
    const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = data.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch {
    // Old format: salt || iv || tag || ciphertext (salt was 32 bytes)
    const SALT_LEN = 32;
    const salt = data.subarray(0, SALT_LEN);
    const iv = data.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = data.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const ciphertext = data.subarray(SALT_LEN + IV_LEN + TAG_LEN);
    const oldKey = scryptSync(passphrase, salt, KEY_LEN) as Buffer;
    const decipher = createDecipheriv(ALGORITHM, oldKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  }
}
