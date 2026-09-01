/**
 * Secure key generation module
 * Generates asymmetric key pairs using X25519 (Curve25519)
 */

import sodium from 'libsodium.js';
import { KeyPair } from '../types/crypto.js';

/**
 * Generate a new X25519 key pair
 * X25519 is used for ECDH key exchange
 *
 * @returns KeyPair with public and private keys
 * @throws Error if key generation fails
 */
export async function generateKeyPair(): Promise<KeyPair> {
  try {
    const keyPair = sodium.crypto_box_keypair();

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  } catch (error) {
    throw new Error(`Failed to generate key pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate that a key pair is properly formed
 *
 * @param keyPair - The key pair to validate
 * @returns true if valid, false otherwise
 */
export function validateKeyPair(keyPair: KeyPair): boolean {
  const PUBLIC_KEY_SIZE = 32;
  const PRIVATE_KEY_SIZE = 32;

  return (
    keyPair.publicKey instanceof Uint8Array &&
    keyPair.privateKey instanceof Uint8Array &&
    keyPair.publicKey.length === PUBLIC_KEY_SIZE &&
    keyPair.privateKey.length === PRIVATE_KEY_SIZE
  );
}

/**
 * Validate a public key format
 *
 * @param publicKey - The public key to validate
 * @returns true if valid, false otherwise
 */
export function validatePublicKey(publicKey: Uint8Array): boolean {
  const PUBLIC_KEY_SIZE = 32;

  return (
    publicKey instanceof Uint8Array &&
    publicKey.length === PUBLIC_KEY_SIZE
  );
}

/**
 * Generate multiple key pairs (for testing or multi-device scenarios)
 *
 * @param count - Number of key pairs to generate
 * @returns Array of KeyPairs
 */
export async function generateMultipleKeyPairs(count: number): Promise<KeyPair[]> {
  const pairs: KeyPair[] = [];

  for (let i = 0; i < count; i++) {
    pairs.push(await generateKeyPair());
  }

  return pairs;
}
