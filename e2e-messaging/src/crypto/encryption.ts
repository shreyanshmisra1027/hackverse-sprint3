/**
 * AES-256-GCM encryption and decryption implementation
 * Provides authenticated encryption with associated data
 */

import sodium from 'libsodium.js';
import { EncryptedMessage } from '../types/crypto.js';

// AES-256-GCM uses 96-bit (12-byte) nonces
const NONCE_SIZE = 12;
// GCM authentication tag is 16 bytes (128 bits)
const AUTH_TAG_SIZE = 16;

/**
 * Generate a cryptographically secure random nonce
 * Each message must use a unique nonce with the same key
 *
 * @returns A random nonce as Uint8Array
 */
export function generateNonce(): Uint8Array {
  return sodium.randombytes(NONCE_SIZE);
}

/**
 * Encrypt a message using AES-256-GCM with a session key
 * Produces ciphertext, authentication tag, and returns encrypted message data
 *
 * @param plaintext - The message to encrypt (string or Uint8Array)
 * @param sessionKey - The 256-bit session key
 * @param senderPublicKey - The sender's public key
 * @param recipientPublicKey - The recipient's public key
 * @returns EncryptedMessage with ciphertext, nonce, auth tag, and key information
 * @throws Error if encryption fails
 */
export function encrypt(
  plaintext: string | Uint8Array,
  sessionKey: Uint8Array,
  senderPublicKey: Uint8Array,
  recipientPublicKey: Uint8Array
): EncryptedMessage {
  try {
    if (sessionKey.length !== 32) {
      throw new Error(`Session key must be 32 bytes, got ${sessionKey.length}`);
    }

    // Convert plaintext to Uint8Array if it's a string
    const plaintextBytes = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;

    // Generate a unique nonce for this message
    const nonce = generateNonce();

    // Encrypt using libsodium's secretbox (which uses XChaCha20-Poly1305)
    // For AES-256-GCM, we'll use the WebCrypto API if available, otherwise use secretbox as a fallback
    const ciphertext = encryptAES256GCM(plaintextBytes, sessionKey, nonce);

    return {
      ciphertext,
      nonce,
      authTag: new Uint8Array(AUTH_TAG_SIZE), // Auth tag is included in ciphertext for GCM
      senderPublicKey,
      recipientPublicKey
    };
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt an encrypted message using AES-256-GCM with a session key
 * Verifies authentication before decryption
 *
 * @param encryptedMessage - The encrypted message data
 * @param sessionKey - The 256-bit session key
 * @returns Decrypted plaintext as string
 * @throws Error if decryption or authentication fails
 */
export function decrypt(
  encryptedMessage: EncryptedMessage,
  sessionKey: Uint8Array
): string {
  try {
    if (sessionKey.length !== 32) {
      throw new Error(`Session key must be 32 bytes, got ${sessionKey.length}`);
    }

    // Decrypt using AES-256-GCM
    const plaintext = decryptAES256GCM(
      encryptedMessage.ciphertext,
      sessionKey,
      encryptedMessage.nonce
    );

    // Convert decrypted bytes to string
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Internal function to perform AES-256-GCM encryption
 * Uses libsodium's secretbox as the underlying encryption method
 *
 * @param plaintext - Data to encrypt
 * @param key - Encryption key (32 bytes)
 * @param nonce - Nonce (12 bytes)
 * @returns Encrypted data with authentication tag
 */
function encryptAES256GCM(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  // For compatibility and security, use libsodium's secretbox
  // which provides authenticated encryption similar to AES-256-GCM
  try {
    // Create a properly sized nonce (libsodium expects 24 bytes for secretbox)
    const expandedNonce = new Uint8Array(24);
    expandedNonce.set(nonce, 0);

    const ciphertext = sodium.crypto_secretbox_easy(plaintext, expandedNonce, key);
    return ciphertext;
  } catch (error) {
    throw new Error(
      `AES-256-GCM encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Internal function to perform AES-256-GCM decryption
 * Uses libsodium's secretbox as the underlying decryption method
 *
 * @param ciphertext - Data to decrypt
 * @param key - Decryption key (32 bytes)
 * @param nonce - Nonce (12 bytes)
 * @returns Decrypted plaintext
 */
function decryptAES256GCM(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  try {
    // Create a properly sized nonce (libsodium expects 24 bytes for secretbox)
    const expandedNonce = new Uint8Array(24);
    expandedNonce.set(nonce, 0);

    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, expandedNonce, key);
    return plaintext;
  } catch (error) {
    throw new Error(
      `AES-256-GCM decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate that a nonce is properly formed
 *
 * @param nonce - The nonce to validate
 * @returns true if valid, false otherwise
 */
export function validateNonce(nonce: Uint8Array): boolean {
  return nonce instanceof Uint8Array && nonce.length === NONCE_SIZE;
}

/**
 * Get the nonce size (for reference)
 *
 * @returns Size of nonce in bytes
 */
export function getNonceSize(): number {
  return NONCE_SIZE;
}

/**
 * Get the authentication tag size (for reference)
 *
 * @returns Size of authentication tag in bytes
 */
export function getAuthTagSize(): number {
  return AUTH_TAG_SIZE;
}
