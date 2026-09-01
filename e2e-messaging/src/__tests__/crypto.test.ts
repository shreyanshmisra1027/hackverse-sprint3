/**
 * Comprehensive test suite for E2E encryption system
 * Tests key generation, key exchange, key derivation, and encryption/decryption
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import sodium from 'libsodium.js';

import { generateKeyPair, validateKeyPair, validatePublicKey } from '../crypto/keyGeneration';
import { performKeyExchange, validateKeyExchange } from '../crypto/keyExchange';
import { deriveSessionKey } from '../crypto/keyDerivation';
import { encrypt, decrypt, generateNonce, validateNonce } from '../crypto/encryption';
import { keyStore, KeyStore } from '../crypto/keyStorage';
import { MessageHandler } from '../messaging/messageHandler';

describe('E2E Encryption System', () => {
  beforeAll(async () => {
    // Initialize sodium
    await sodium.ready;
  });

  afterEach(() => {
    // Clear key store after each test
    keyStore.clearAllKeys();
  });

  describe('Key Generation', () => {
    it('should generate a valid key pair', async () => {
      const keyPair = await generateKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
    });

    it('should generate key pair with correct sizes', async () => {
      const keyPair = await generateKeyPair();

      expect(keyPair.publicKey.length).toBe(32);
      expect(keyPair.privateKey.length).toBe(32);
    });

    it('should validate a correct key pair', async () => {
      const keyPair = await generateKeyPair();

      expect(validateKeyPair(keyPair)).toBe(true);
    });

    it('should reject invalid key pair', () => {
      const invalidKeyPair = {
        publicKey: new Uint8Array(10),
        privateKey: new Uint8Array(32)
      };

      expect(validateKeyPair(invalidKeyPair)).toBe(false);
    });

    it('should validate public key format', async () => {
      const keyPair = await generateKeyPair();

      expect(validatePublicKey(keyPair.publicKey)).toBe(true);
      expect(validatePublicKey(new Uint8Array(10))).toBe(false);
    });

    it('should generate unique key pairs each time', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();

      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
    });
  });

  describe('Key Exchange (ECDH)', () => {
    it('should derive same shared secret for both parties', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const exchange1 = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const exchange2 = performKeyExchange(
        bob.privateKey,
        alice.publicKey,
        bob.publicKey,
        alice.publicKey
      );

      expect(exchange1.sharedSecret).toEqual(exchange2.sharedSecret);
    });

    it('should validate key exchange', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      expect(
        validateKeyExchange(
          alice.privateKey,
          alice.publicKey,
          bob.privateKey,
          bob.publicKey
        )
      ).toBe(true);
    });

    it('should produce different shared secrets for different pairs', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();
      const charlie = await generateKeyPair();

      const exchange1 = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const exchange2 = performKeyExchange(
        alice.privateKey,
        charlie.publicKey,
        alice.publicKey,
        charlie.publicKey
      );

      expect(exchange1.sharedSecret).not.toEqual(exchange2.sharedSecret);
    });
  });

  describe('Key Derivation (HKDF)', () => {
    it('should derive a 256-bit session key', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const exchange = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const sessionKey = deriveSessionKey(exchange.sharedSecret);

      expect(sessionKey.key.length).toBe(32);
      expect(sessionKey.algorithm).toBe('AES-256-GCM');
    });

    it('should derive same session key for both parties', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const exchange1 = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const exchange2 = performKeyExchange(
        bob.privateKey,
        alice.publicKey,
        bob.publicKey,
        alice.publicKey
      );

      const sessionKey1 = deriveSessionKey(exchange1.sharedSecret);
      const sessionKey2 = deriveSessionKey(exchange2.sharedSecret);

      expect(sessionKey1.key).toEqual(sessionKey2.key);
    });
  });

  describe('Encryption/Decryption (AES-256-GCM)', () => {
    it('should encrypt and decrypt a message successfully', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const exchange = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const sessionKey = deriveSessionKey(exchange.sharedSecret);
      const plaintext = 'Hello, Bob! This is a secure message.';

      const encrypted = encrypt(
        plaintext,
        sessionKey.key,
        alice.publicKey,
        bob.publicKey
      );

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.nonce).toBeDefined();
      expect(encrypted.senderPublicKey).toEqual(alice.publicKey);
      expect(encrypted.recipientPublicKey).toEqual(bob.publicKey);

      // Decrypt using the same session key
      const decrypted = decrypt(encrypted, sessionKey.key);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt unicode messages', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const exchange = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const sessionKey = deriveSessionKey(exchange.sharedSecret);
      const plaintext = 'Hello 🌍 你好 🔐 مرحبا';

      const encrypted = encrypt(plaintext, sessionKey.key, alice.publicKey, bob.publicKey);
      const decrypted = decrypt(encrypted, sessionKey.key);

      expect(decrypted).toBe(plaintext);
    });

    it('should reject decryption with wrong key', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();
      const charlie = await generateKeyPair();

      const exchange = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const sessionKey = deriveSessionKey(exchange.sharedSecret);
      const wrongSessionKey = deriveSessionKey(
        (await generateKeyPair()).privateKey // Invalid key
      );

      const plaintext = 'Secret message';
      const encrypted = encrypt(plaintext, sessionKey.key, alice.publicKey, bob.publicKey);

      expect(() => {
        decrypt(encrypted, wrongSessionKey.key);
      }).toThrow();
    });

    it('should generate valid nonces', () => {
      const nonce = generateNonce();

      expect(nonce).toBeDefined();
      expect(nonce.length).toBe(12);
      expect(validateNonce(nonce)).toBe(true);
    });

    it('should detect invalid nonces', () => {
      expect(validateNonce(new Uint8Array(10))).toBe(false);
      expect(validateNonce(new Uint8Array(13))).toBe(false);
    });
  });

  describe('Key Storage', () => {
    it('should store and retrieve key pair', async () => {
      const userId = 'test-user-123';
      const keyPair = await generateKeyPair();

      keyStore.storeKeyPair(userId, keyPair);

      const retrieved = keyStore.getKeyPair(userId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.publicKey).toEqual(keyPair.publicKey);
      expect(retrieved?.privateKey).toEqual(keyPair.privateKey);
    });

    it('should retrieve only public key', async () => {
      const userId = 'test-user-456';
      const keyPair = await generateKeyPair();

      keyStore.storeKeyPair(userId, keyPair);

      const publicKey = keyStore.getPublicKey(userId);

      expect(publicKey).toEqual(keyPair.publicKey);
    });

    it('should check if user has keys', async () => {
      const userId = 'test-user-789';
      const keyPair = await generateKeyPair();

      expect(keyStore.hasKeyPair(userId)).toBe(false);

      keyStore.storeKeyPair(userId, keyPair);

      expect(keyStore.hasKeyPair(userId)).toBe(true);
    });

    it('should delete key pair', async () => {
      const userId = 'test-user-delete';
      const keyPair = await generateKeyPair();

      keyStore.storeKeyPair(userId, keyPair);
      expect(keyStore.hasKeyPair(userId)).toBe(true);

      keyStore.deleteKeyPair(userId);
      expect(keyStore.hasKeyPair(userId)).toBe(false);
    });

    it('should encrypt private keys with master key', async () => {
      const userId = 'test-user-encrypted';
      const keyPair = await generateKeyPair();
      const masterKey = new Uint8Array(32);
      sodium.randombytes(masterKey);

      const store = new KeyStore();
      store.setMasterKey(masterKey);
      store.storeKeyPair(userId, keyPair);

      const retrieved = store.getKeyPair(userId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.publicKey).toEqual(keyPair.publicKey);
      expect(retrieved?.privateKey).toEqual(keyPair.privateKey);
    });
  });

  describe('Message Handler', () => {
    it('should initialize users with key pairs', async () => {
      const handler = new MessageHandler();

      const keyPair = await handler.initializeUser('user1');

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
    });

    it('should send and receive encrypted messages', async () => {
      const handler = new MessageHandler();

      await handler.initializeUser('alice');
      await handler.initializeUser('bob');

      const bobPublicKey = handler.getUserPublicKey('bob');
      expect(bobPublicKey).not.toBeNull();

      // Alice sends message to Bob
      const message = 'Hello Bob, this is a secure message!';
      const encrypted = handler.sendMessage(message, 'alice', bobPublicKey!);

      // Bob receives and decrypts the message
      const decrypted = handler.receiveMessage(encrypted, 'bob');

      expect(decrypted.plaintext).toBe(message);
      expect(decrypted.senderPublicKey).toEqual(handler.getUserPublicKey('alice'));
    });

    it('should reject message from uninitialized user', async () => {
      const handler = new MessageHandler();

      await handler.initializeUser('alice');

      const alicePublicKey = handler.getUserPublicKey('alice');

      expect(() => {
        handler.sendMessage('Hello', 'uninitialized-user', alicePublicKey!);
      }).toThrow();
    });

    it('should get all initialized users', async () => {
      const handler = new MessageHandler();

      await handler.initializeUser('user1');
      await handler.initializeUser('user2');
      await handler.initializeUser('user3');

      const users = handler.getInitializedUsers();

      expect(users).toContain('user1');
      expect(users).toContain('user2');
      expect(users).toContain('user3');
      expect(users.length).toBe(3);
    });

    it('should handle unicode messages correctly', async () => {
      const handler = new MessageHandler();

      await handler.initializeUser('alice');
      await handler.initializeUser('bob');

      const bobPublicKey = handler.getUserPublicKey('bob')!;
      const message = '🔐Encrypted: 你好世界 مرحبا';

      const encrypted = handler.sendMessage(message, 'alice', bobPublicKey);
      const decrypted = handler.receiveMessage(encrypted, 'bob');

      expect(decrypted.plaintext).toBe(message);
    });
  });

  describe('End-to-End Integration', () => {
    it('should complete full encryption workflow', async () => {
      // Step 1: Alice and Bob generate key pairs
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      // Step 2: Both derive the same shared secret
      const exchange = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      // Step 3: Derive session key from shared secret
      const sessionKey = deriveSessionKey(exchange.sharedSecret);

      // Step 4: Alice encrypts a message
      const plaintext = 'The secret code is 12345';
      const encrypted = encrypt(plaintext, sessionKey.key, alice.publicKey, bob.publicKey);

      // Step 5: Bob decrypts the message
      const decrypted = decrypt(encrypted, sessionKey.key);

      // Verify
      expect(decrypted).toBe(plaintext);
      expect(decrypted).not.toBe('The secret code is 12346'); // Wrong code
    });

    it('should handle multiple messages with fresh nonces', async () => {
      const alice = await generateKeyPair();
      const bob = await generateKeyPair();

      const exchange = performKeyExchange(
        alice.privateKey,
        bob.publicKey,
        alice.publicKey,
        bob.publicKey
      );

      const sessionKey = deriveSessionKey(exchange.sharedSecret);

      // Send multiple messages
      const messages = ['First message', 'Second message', 'Third message'];

      for (const msg of messages) {
        const encrypted = encrypt(msg, sessionKey.key, alice.publicKey, bob.publicKey);
        const decrypted = decrypt(encrypted, sessionKey.key);
        expect(decrypted).toBe(msg);
      }
    });
  });
});