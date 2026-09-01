/**
 * Message handling for E2E encrypted messaging
 * Orchestrates the full encryption and decryption pipeline
 */

import { KeyPair, EncryptedMessage, DecryptedMessage } from '../types/crypto.js';
import { generateKeyPair, validateKeyPair } from '../crypto/keyGeneration.js';
import { performKeyExchange } from '../crypto/keyExchange.js';
import { deriveSessionKey } from '../crypto/keyDerivation.js';
import { encrypt, decrypt } from '../crypto/encryption.js';
import { keyStore } from '../crypto/keyStorage.js';

export interface SendOptions {
  userId: string;
  recipientPublicKey: Uint8Array;
}

export interface MessageContext {
  userId: string;
  senderPublicKey: Uint8Array;
  recipientPublicKey: Uint8Array;
  timestamp: number;
}

/**
 * Message handler that manages the complete E2E encryption workflow
 */
export class MessageHandler {
  private userIdToKeyPair: Map<string, KeyPair> = new Map();

  /**
   * Initialize a user with a new key pair
   * Generates and stores keys for the user
   *
   * @param userId - Unique user identifier
   * @returns The generated KeyPair
   */
  async initializeUser(userId: string): Promise<KeyPair> {
    try {
      // Check if user already has keys
      if (this.userIdToKeyPair.has(userId)) {
        throw new Error(`User ${userId} already has keys initialized`);
      }

      // Generate new key pair
      const keyPair = await generateKeyPair();

      // Validate the generated key pair
      if (!validateKeyPair(keyPair)) {
        throw new Error('Generated key pair failed validation');
      }

      // Store the key pair
      this.userIdToKeyPair.set(userId, keyPair);
      keyStore.storeKeyPair(userId, keyPair);

      return keyPair;
    } catch (error) {
      throw new Error(
        `Failed to initialize user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a user's public key
   *
   * @param userId - User identifier
   * @returns The public key, or null if user not found
   */
  getUserPublicKey(userId: string): Uint8Array | null {
    const keyPair = this.userIdToKeyPair.get(userId);
    return keyPair?.publicKey || keyStore.getPublicKey(userId);
  }

  /**
   * Send an encrypted message to a recipient
   * Performs ECDH key exchange, derives session key, and encrypts the message
   *
   * @param message - The plaintext message
   * @param senderId - The sender's user ID
   * @param recipientPublicKey - The recipient's public key
   * @returns The encrypted message ready to send
   */
  sendMessage(
    message: string,
    senderId: string,
    recipientPublicKey: Uint8Array
  ): EncryptedMessage {
    try {
      // Get sender's key pair
      const senderKeyPair = this.userIdToKeyPair.get(senderId);
      if (!senderKeyPair) {
        throw new Error(`User ${senderId} not initialized`);
      }

      // Perform ECDH key exchange
      const keyExchange = performKeyExchange(
        senderKeyPair.privateKey,
        recipientPublicKey,
        senderKeyPair.publicKey,
        recipientPublicKey
      );

      // Derive session key from shared secret
      const sessionKeyData = deriveSessionKey(keyExchange.sharedSecret);

      // Encrypt the message
      const encryptedMessage = encrypt(
        message,
        sessionKeyData.key,
        senderKeyPair.publicKey,
        recipientPublicKey
      );

      return encryptedMessage;
    } catch (error) {
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Receive and decrypt an encrypted message
   * Performs ECDH key exchange, derives session key, and decrypts the message
   *
   * @param encryptedMessage - The encrypted message data
   * @param recipientId - The recipient's user ID (the person receiving)
   * @returns The decrypted message
   */
  receiveMessage(
    encryptedMessage: EncryptedMessage,
    recipientId: string
  ): DecryptedMessage {
    try {
      // Get recipient's key pair
      const recipientKeyPair = this.userIdToKeyPair.get(recipientId);
      if (!recipientKeyPair) {
        throw new Error(`User ${recipientId} not initialized`);
      }

      // Perform ECDH key exchange using recipient's private key and sender's public key
      const keyExchange = performKeyExchange(
        recipientKeyPair.privateKey,
        encryptedMessage.senderPublicKey,
        encryptedMessage.senderPublicKey,
        recipientKeyPair.publicKey
      );

      // Derive session key from shared secret
      const sessionKeyData = deriveSessionKey(keyExchange.sharedSecret);

      // Decrypt the message
      const plaintext = decrypt(encryptedMessage, sessionKeyData.key);

      return {
        plaintext,
        senderPublicKey: encryptedMessage.senderPublicKey,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(
        `Failed to receive message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all initialized users
   *
   * @returns Array of user IDs
   */
  getInitializedUsers(): string[] {
    return Array.from(this.userIdToKeyPair.keys());
  }

  /**
   * Clear all user data (useful for testing)
   */
  clearAllUsers(): void {
    this.userIdToKeyPair.clear();
  }
}

// Export singleton instance
export const messageHandler = new MessageHandler();
