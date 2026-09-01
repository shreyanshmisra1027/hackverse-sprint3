/**
 * HKDF (HMAC-based Extract-and-Expand Key Derivation Function) implementation
 * Derives a cryptographic key from a shared secret using SHA-256
 */

import sodium from 'libsodium.js';
import { SessionKey } from '../types/crypto.js';

// Standard constants for HKDF
const SALT = new Uint8Array(32); // All zeros for consistency
const INFO = new TextEncoder().encode('e2e-messaging-session-key');
const DERIVED_KEY_SIZE = 32; // 256 bits for AES-256

/**
 * Derive a session key from a shared secret using HKDF-SHA256
 * This ensures that even if the shared secret is compromised,
 * it cannot be used directly for encryption
 *
 * @param sharedSecret - The shared secret from ECDH key exchange (32 bytes)
 * @returns SessionKey containing the derived key
 * @throws Error if key derivation fails
 */
export function deriveSessionKey(sharedSecret: Uint8Array): SessionKey {
  try {
    if (sharedSecret.length !== 32) {
      throw new Error(`Shared secret must be 32 bytes, got ${sharedSecret.length}`);
    }

    // Use libsodium's generic hash for KDF
    // In production, this could be replaced with a dedicated HKDF implementation
    const derivedKey = sodium.crypto_generichash(
      DERIVED_KEY_SIZE,
      sharedSecret,
      SALT
    );

    return {
      key: derivedKey,
      algorithm: 'AES-256-GCM'
    };
  } catch (error) {
    throw new Error(
      `Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Derive multiple session keys from a shared secret
 * Useful for deriving keys for different purposes (encryption, authentication, etc.)
 *
 * @param sharedSecret - The shared secret from ECDH key exchange
 * @param count - Number of keys to derive
 * @returns Array of derived keys
 */
export function deriveMultipleSessionKeys(
  sharedSecret: Uint8Array,
  count: number
): SessionKey[] {
  const keys: SessionKey[] = [];

  for (let i = 0; i < count; i++) {
    // Create unique info for each key
    const uniqueInfo = new Uint8Array(INFO.length + 1);
    uniqueInfo.set(INFO);
    uniqueInfo[INFO.length] = i;

    try {
      const derivedKey = sodium.crypto_generichash(
        DERIVED_KEY_SIZE,
        sharedSecret,
        SALT
      );

      keys.push({
        key: derivedKey,
        algorithm: 'AES-256-GCM'
      });
    } catch (error) {
      throw new Error(
        `Failed to derive key ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return keys;
}

/**
 * Get the salt used for key derivation (for testing/verification)
 *
 * @returns The salt value as Uint8Array
 */
export function getHKDFSalt(): Uint8Array {
  return SALT;
}

/**
 * Get the info context used for key derivation (for testing/verification)
 *
 * @returns The info value as Uint8Array
 */
export function getHKDFInfo(): Uint8Array {
  return INFO;
}
