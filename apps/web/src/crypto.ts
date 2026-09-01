/**
 * Deliberately small MVP crypto boundary. The creator transfers this symmetric
 * key through the already-established data channel. Replace with authenticated
 * ECDH before treating this as production security.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function createRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportRoomKey(key: CryptoKey): Promise<string> {
  return bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function importRoomKey(encoded: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(encoded);
  return crypto.subtle.importKey("raw", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(value))));
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv); packed.set(ciphertext, iv.length);
  return bytesToBase64(packed);
}

export async function decryptJson<T>(key: CryptoKey, payload: string): Promise<T> {
  const packed = base64ToBytes(payload);
  if (packed.length < 13) throw new Error("Invalid encrypted payload.");
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
