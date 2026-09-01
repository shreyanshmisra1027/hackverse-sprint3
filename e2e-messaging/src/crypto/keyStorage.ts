/**
 * Secure key storage and management
 * Handles storing and retrieving cryptographic keys with optional encryption
 */

import sodium from 'libsodium.js';
import { KeyPair, StoredKeyPair } from '../types/crypto.js';

/**
 * In-memory key storage with encryption support
 * In production, this should be stored in secure storage (IndexedDB, secure enclave, etc.)
 */
class KeyStore {
  private keyMap: Map<string, StoredKeyPair> = new Map();
  private masterKey: Uint8Array | null = null;

  /**
   * Set a master key for encrypting stored private keys
   * This key should be derived from a password or retrieved from secure storage
   *
   * @param key - Master key for encryption (32 bytes)
   */
  setMasterKey(key: Uint8Array): void {
    if (key.length !== 32) {
      throw new Error(`Master key must be 32 bytes, got ${key.length}`);
    }
    this.masterKey = key;
  }

  /**
   * Store a key pair for a user
   *
   * @param userId - Unique user identifier
   * @param keyPair - The key pair to store
   * @throws Error if master key is not set or storage fails
   */
  storeKeyPair(userId: string, keyPair: KeyPair): void {
    try {
      let privateKeyEncoded = this.uint8ArrayToBase64(keyPair.privateKey);

      // Encrypt private key if master key is available
      if (this.masterKey) {
        const nonce = sodium.randombytes(24);
        const privateKeyBytes = keyPair.privateKey;
        const encrypted = sodium.crypto_secretbox_easy(
          privateKeyBytes,
          nonce,
          this.masterKey
        );

        // Combine nonce and ciphertext for storage
        const combined = new Uint8Array(nonce.length + encrypted.length);
        combined.set(nonce);
        combined.set(encrypted, nonce.length);

        privateKeyEncoded = this.uint8ArrayToBase64(combined);
      }

      const storedKeyPair: StoredKeyPair = {
        userId,
        publicKey: this.uint8ArrayToBase64(keyPair.publicKey),
        privateKey: privateKeyEncoded,
        createdAt: Date.now()
      };

      this.keyMap.set(userId, storedKeyPair);
    } catch (error) {
      throw new Error(
        `Failed to store key pair: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieve a stored key pair
   *
   * @param userId - User identifier
   * @returns The key pair, or null if not found
   * @throws Error if decryption fails
   */
  getKeyPair(userId: string): KeyPair | null {
    try {
      const stored = this.keyMap.get(userId);
      if (!stored) {
        return null;
      }

      const publicKey = this.base64ToUint8Array(stored.publicKey);
      let privateKey: Uint8Array;

      if (this.masterKey) {
        // Decrypt private key
        const combined = this.base64ToUint8Array(stored.privateKey);
        const nonce = combined.slice(0, 24);
        const ciphertext = combined.slice(24);

        privateKey = sodium.crypto_secretbox_open_easy(ciphertext, nonce, this.masterKey);
      } else {
        privateKey = this.base64ToUint8Array(stored.privateKey);
      }

      return { publicKey, privateKey };
    } catch (error) {
      throw new Error(
        `Failed to retrieve key pair: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get only the public key for a user
   *
   * @param userId - User identifier
   * @returns The public key, or null if not found
   */
  getPublicKey(userId: string): Uint8Array | null {
    const stored = this.keyMap.get(userId);
    if (!stored) {
      return null;
    }
    return this.base64ToUint8Array(stored.publicKey);
  }

  /**
   * Check if a user has stored keys
   *
   * @param userId - User identifier
   * @returns true if user has stored keys, false otherwise
   */
  hasKeyPair(userId: string): boolean {
    return this.keyMap.has(userId);
  }

  /**
   * Delete a user's stored keys
   *
   * @param userId - User identifier
   * @returns true if deletion was successful, false if user not found
   */
  deleteKeyPair(userId: string): boolean {
    return this.keyMap.delete(userId);
  }

  /**
   * Clear all stored keys
   */
  clearAllKeys(): void {
    this.keyMap.clear();
  }

  /**
   * Get all stored user IDs
   *
   * @returns Array of user IDs with stored keys
   */
  getAllUserIds(): string[] {
    return Array.from(this.keyMap.keys());
  }

  /**
   * Convert Uint8Array to Base64 string
   */
  private uint8ArrayToBase64(data: Uint8Array): string {
    return sodium.to_base64(data);
  }

  /**
   * Convert Base64 string to Uint8Array
   */
  private base64ToUint8Array(data: string): Uint8Array {
    return sodium.from_base64(data);
  }
}

// Export singleton instance
export const keyStore = new KeyStore();

/**
 * Export KeyStore class for testing or custom instances
 */
export { KeyStore };
