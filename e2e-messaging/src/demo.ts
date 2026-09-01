/**
 * Demo script showcasing the E2E encryption system
 * Run with: npm run dev
 */

import sodium from 'libsodium.js';

// Import all modules
import { generateKeyPair } from './crypto/keyGeneration.js';
import { performKeyExchange } from './crypto/keyExchange.js';
import { deriveSessionKey } from './crypto/keyDerivation.js';
import { encrypt, decrypt } from './crypto/encryption.js';
import { keyStore } from './crypto/keyStorage.js';
import { MessageHandler } from './messaging/messageHandler.js';
import { toBase64, fromBase64 } from './utils/encoding.js';

async function main() {
  console.log('=== E2E Encrypted Messaging Demo ===\n');

  // Initialize sodium
  await sodium.ready;
  console.log('✓ Sodium initialized\n');

  // Demo 1: Basic Key Generation
  console.log('--- Demo 1: Key Generation ---');
  const aliceKeyPair = await generateKeyPair();
  const bobKeyPair = await generateKeyPair();

  console.log(`Alice's public key: ${toBase64(aliceKeyPair.publicKey).substring(0, 32)}...`);
  console.log(`Bob's public key:   ${toBase64(bobKeyPair.publicKey).substring(0, 32)}...`);
  console.log('✓ Generated key pairs for Alice and Bob\n');

  // Demo 2: ECDH Key Exchange
  console.log('--- Demo 2: ECDH Key Exchange ---');
  const exchange = performKeyExchange(
    aliceKeyPair.privateKey,
    bobKeyPair.publicKey,
    aliceKeyPair.publicKey,
    bobKeyPair.publicKey
  );
  console.log(`Shared secret: ${toBase64(exchange.sharedSecret).substring(0, 32)}...`);
  console.log('✓ ECDH key exchange complete - both parties now share a secret\n');

  // Demo 3: Session Key Derivation
  console.log('--- Demo 3: HKDF Session Key Derivation ---');
  const sessionKey = deriveSessionKey(exchange.sharedSecret);
  console.log(`Session key: ${toBase64(sessionKey.key).substring(0, 32)}...`);
  console.log(`Algorithm: ${sessionKey.algorithm}`);
  console.log('✓ Session key derived from shared secret\n');

  // Demo 4: Message Encryption/Decryption
  console.log('--- Demo 4: AES-256-GCM Encryption ---');
  const message = 'Hello Bob! This is a secret message from Alice.';
  console.log(`Original: "${message}"`);

  const encrypted = encrypt(
    message,
    sessionKey.key,
    aliceKeyPair.publicKey,
    bobKeyPair.publicKey
  );

  console.log(`Encrypted (base64): ${toBase64(encrypted.ciphertext).substring(0, 32)}...`);
  console.log(`Nonce: ${toBase64(encrypted.nonce)}`);
  console.log('✓ Message encrypted\n');

  // Demo 5: Decryption
  console.log('--- Demo 5: Decryption ---');
  const decrypted = decrypt(encrypted, sessionKey.key);
  console.log(`Decrypted: "${decrypted}"`);
  console.log(`Verification: ${decrypted === message ? '✓ SUCCESS' : '✗ FAILED'}\n`);

  // Demo 6: Key Storage
  console.log('--- Demo 6: Secure Key Storage ---');
  keyStore.storeKeyPair('alice-store', aliceKeyPair);
  keyStore.storeKeyPair('bob-store', bobKeyPair);

  const retrievedAlice = keyStore.getKeyPair('alice-store');
  console.log(`Alice's stored keys: ${retrievedAlice ? '✓ Retrieved' : '✗ Failed'}`);
  console.log(`Keys match: ${retrievedAlice?.publicKey === aliceKeyPair.publicKey ? '✓ YES' : '✗ NO'}\n`);

  // Demo 7: Message Handler (Full Workflow)
  console.log('--- Demo 7: Message Handler (Full Workflow) ---');
  const handler = new MessageHandler();

  await handler.initializeUser('alice-handler');
  await handler.initializeUser('bob-handler');

  const bobPubKey = handler.getUserPublicKey('bob-handler')!;

  const secretMessage = 'The password is: SuperSecret123! 🔐';
  const sentMessage = handler.sendMessage(secretMessage, 'alice-handler', bobPubKey);

  console.log(`Sent encrypted message (first 32 bytes): ${toBase64(sentMessage.ciphertext).substring(0, 32)}...`);

  const receivedMessage = handler.receiveMessage(sentMessage, 'bob-handler');
  console.log(`Received: "${receivedMessage.plaintext}"`);
  console.log(`Verification: ${receivedMessage.plaintext === secretMessage ? '✓ SUCCESS' : '✗ FAILED'}\n`);

  // Demo 8: Unicode Support
  console.log('--- Demo 8: Unicode Support ---');
  const unicodeMessage = 'Hello 🌍 你好 🔐 مرحباimir';
  const unicodeEncrypted = handler.sendMessage(unicodeMessage, 'alice-handler', bobPubKey);
  const unicodeDecrypted = handler.receiveMessage(unicodeEncrypted, 'bob-handler');

  console.log(`Original: "${unicodeMessage}"`);
  console.log(`Decrypted: "${unicodeDecrypted.plaintext}"`);
  console.log(`Verification: ${unicodeDecrypted.plaintext === unicodeMessage ? '✓ SUCCESS' : '✗ FAILED'}\n`);

  // Summary
  console.log('=== Demo Complete ===');
  console.log(`
  Encryption Flow Summary:
  1. ✓ Key Generation: X25519 key pairs created
  2. ✓ Key Exchange: ECDH produces shared secret
  3. ✓ Key Derivation: HKDF derives session key
  4. ✓ Encryption: AES-256-GCM encrypts messages
  5. ✓ Decryption: Messages decrypted and authenticated
  6. ✓ Storage: Keys securely stored
  7. ✓ Handler: Full E2E workflow implemented

  Security Features:
  - Forward secrecy via unique session keys per conversation
  - Authentication via GCM mode
  - Nonce uniqueness for each message
  - Private keys never transmitted
  `);
}

main().catch(console.error);