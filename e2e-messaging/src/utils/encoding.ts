/**
 * Utility functions for encoding and decoding cryptographic data
 */

import sodium from 'libsodium.js';

/**
 * Convert Uint8Array to Base64 string
 *
 * @param data - Data to encode
 * @returns Base64 encoded string
 */
export function toBase64(data: Uint8Array): string {
  return sodium.to_base64(data);
}

/**
 * Convert Base64 string to Uint8Array
 *
 * @param data - Base64 string to decode
 * @returns Decoded Uint8Array
 */
export function fromBase64(data: string): Uint8Array {
  return sodium.from_base64(data);
}

/**
 * Convert Uint8Array to Hex string
 *
 * @param data - Data to encode
 * @returns Hex encoded string
 */
export function toHex(data: Uint8Array): string {
  return sodium.to_hex(data);
}

/**
 * Convert Hex string to Uint8Array
 *
 * @param data - Hex string to decode
 * @returns Decoded Uint8Array
 */
export function fromHex(data: string): Uint8Array {
  return sodium.from_hex(data);
}

/**
 * Convert string to Uint8Array using UTF-8 encoding
 *
 * @param text - String to convert
 * @returns Uint8Array
 */
export function stringToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Convert Uint8Array to string using UTF-8 decoding
 *
 * @param data - Uint8Array to convert
 * @returns Decoded string
 */
export function bytesToString(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

/**
 * Serialize encrypted message to JSON with Base64 encoded binary data
 *
 * @param ciphertext - Encrypted data
 * @param nonce - Nonce used for encryption
 * @param senderPublicKey - Sender's public key
 * @param recipientPublicKey - Recipient's public key
 * @returns JSON serializable object
 */
export function serializeEncryptedMessage(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  senderPublicKey: Uint8Array,
  recipientPublicKey: Uint8Array
): Record<string, string> {
  return {
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(nonce),
    senderPublicKey: toBase64(senderPublicKey),
    recipientPublicKey: toBase64(recipientPublicKey)
  };
}

/**
 * Deserialize JSON message to encrypted message format
 *
 * @param data - Serialized message object
 * @returns Object with Uint8Array binary data
 */
export function deserializeEncryptedMessage(
  data: Record<string, string>
): {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  senderPublicKey: Uint8Array;
  recipientPublicKey: Uint8Array;
} {
  return {
    ciphertext: fromBase64(data.ciphertext),
    nonce: fromBase64(data.nonce),
    senderPublicKey: fromBase64(data.senderPublicKey),
    recipientPublicKey: fromBase64(data.recipientPublicKey)
  };
}
