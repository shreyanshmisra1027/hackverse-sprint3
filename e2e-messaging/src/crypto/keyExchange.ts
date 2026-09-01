/**
 * ECDH (Elliptic Curve Diffie-Hellman) key exchange implementation
 * Uses X25519 for asymmetric key agreement
 */

import sodium from 'libsodium.js';
import { KeyExchangeData } from '../types/crypto.js';

/**
 * Perform ECDH key exchange to derive a shared secret
 * Both parties independently derive the same shared secret using their private key
 * and the other party's public key
 *
 * @param ownPrivateKey - The caller's private key
 * @param otherPublicKey - The other party's public key
 * @param senderPublicKey - The sender's public key (for metadata)
 * @param recipientPublicKey - The recipient's public key (for metadata)
 * @returns KeyExchangeData containing the shared secret and public keys
 * @throws Error if key exchange fails
 */
export function performKeyExchange(
  ownPrivateKey: Uint8Array,
  otherPublicKey: Uint8Array,
  senderPublicKey: Uint8Array,
  recipientPublicKey: Uint8Array
): KeyExchangeData {
  try {
    // Perform ECDH using X25519
    const sharedSecret = sodium.crypto_scalarmult(ownPrivateKey, otherPublicKey);

    return {
      sharedSecret,
      senderPublicKey,
      recipientPublicKey
    };
  } catch (error) {
    throw new Error(
      `Key exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate that both parties can derive the same shared secret
 * This is used for testing and verification purposes
 *
 * @param privateKeyA - Alice's private key
 * @param publicKeyA - Alice's public key
 * @param privateKeyB - Bob's private key
 * @param publicKeyB - Bob's public key
 * @returns true if both parties derive the same shared secret, false otherwise
 */
export function validateKeyExchange(
  privateKeyA: Uint8Array,
  publicKeyA: Uint8Array,
  privateKeyB: Uint8Array,
  publicKeyB: Uint8Array
): boolean {
  try {
    // Alice computes shared secret using her private key and Bob's public key
    const sharedSecretA = sodium.crypto_scalarmult(privateKeyA, publicKeyB);

    // Bob computes shared secret using his private key and Alice's public key
    const sharedSecretB = sodium.crypto_scalarmult(privateKeyB, publicKeyA);

    // Both should be identical
    return sodium.memcmp(sharedSecretA, sharedSecretB);
  } catch (error) {
    return false;
  }
}
