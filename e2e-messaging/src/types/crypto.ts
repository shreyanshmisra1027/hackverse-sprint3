/**
 * Cryptographic type definitions for E2E messaging system
 */

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface EncryptedMessage {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  authTag: Uint8Array;
  senderPublicKey: Uint8Array;
  recipientPublicKey: Uint8Array;
}

export interface DecryptedMessage {
  plaintext: string;
  senderPublicKey: Uint8Array;
  timestamp: number;
}

export interface SessionKey {
  key: Uint8Array;
  algorithm: 'AES-256-GCM';
}

export interface KeyExchangeData {
  sharedSecret: Uint8Array;
  senderPublicKey: Uint8Array;
  recipientPublicKey: Uint8Array;
}

export interface StoredKeyPair {
  userId: string;
  publicKey: string; // base64 encoded
  privateKey: string; // base64 encoded, encrypted if stored
  createdAt: number;
}

export interface CryptoConfig {
  algorithm: 'ECDH';
  curve: 'X25519';
  symmetricAlgorithm: 'AES-256-GCM';
  keyDerivation: 'HKDF-SHA256';
  hashAlgorithm: 'SHA-256';
}
