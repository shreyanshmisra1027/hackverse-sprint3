# E2E Encrypted Messaging System

A comprehensive end-to-end encryption system for secure messaging applications.

## Features

- **X25519 Key Generation**: Secure asymmetric key pairs for each user
- **ECDH Key Exchange**: Elliptic Curve Diffie-Hellman for shared secret derivation
- **HKDF Key Derivation**: Derives cryptographically strong session keys
- **AES-256-GCM Encryption**: Authenticated encryption with associated data
- **Secure Key Storage**: Optional encryption for private key storage
- **Full Message Pipeline**: Complete send/receive workflow with encryption

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     E2E Encryption Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User A                          User B                         │
│  ┌─────────────┐                ┌─────────────┐               │
│  │ Key Pair    │                │ Key Pair    │               │
│  │ - Public Key│◄──────────────►│ - Public Key│               │
│  │ - Private Key                 │ - Private Key                 │
│  └─────────────┘                └─────────────┘               │
│          │                            │                         │
│          ▼                            ▼                         │
│  ┌─────────────────┐          ┌─────────────────┐             │
│  │ ECDH Key        │          │ ECDH Key        │             │
│  │ Exchange        │◄────────►│ Exchange        │             │
│  │ (shared secret) │          │ (shared secret) │             │
│  └─────────────────┘          └─────────────────┘             │
│          │                            │                         │
│          ▼                            ▼                         │
│  ┌─────────────────┐          ┌─────────────────┐             │
│  │ HKDF Key        │          │ HKDF Key        │             │
│  │ Derivation      │          │ Derivation      │             │
│  │ (session key)   │          │ (session key)   │             │
│  └─────────────────┘          └─────────────────┘             │
│          │                            │                         │
│          ▼                            ▼                         │
│  ┌─────────────────┐          ┌─────────────────┐             │
│  │ AES-256-GCM     │─────────►│ AES-256-GCM     │             │
│  │ Encrypt         │  send    │ Decrypt         │             │
│  └─────────────────┘          └─────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
cd e2e-messaging
npm install
```

## Usage

### Basic Example

```typescript
import sodium from 'libsodium.js';
import { generateKeyPair } from './crypto/keyGeneration.js';
import { performKeyExchange } from './crypto/keyExchange.js';
import { deriveSessionKey } from './crypto/keyDerivation.js';
import { encrypt, decrypt } from './crypto/encryption.js';

await sodium.ready;

// 1. Generate key pairs for both users
const alice = await generateKeyPair();
const bob = await generateKeyPair();

// 2. Perform ECDH key exchange
const exchange = performKeyExchange(
  alice.privateKey,
  bob.publicKey,
  alice.publicKey,
  bob.publicKey
);

// 3. Derive session key
const sessionKey = deriveSessionKey(exchange.sharedSecret);

// 4. Encrypt message
const message = 'Hello, secure world!';
const encrypted = encrypt(message, sessionKey.key, alice.publicKey, bob.publicKey);

// 5. Decrypt message
const decrypted = decrypt(encrypted, sessionKey.key);
console.log(decrypted); // "Hello, secure world!"
```

### Using the Message Handler

```typescript
import { MessageHandler } from './messaging/messageHandler.js';

// Initialize handler
const handler = new MessageHandler();

// Initialize users
await handler.initializeUser('alice');
await handler.initializeUser('bob');

// Get recipient's public key
const bobPublicKey = handler.getUserPublicKey('bob');

// Send encrypted message
const encrypted = handler.sendMessage('Secret message', 'alice', bobPublicKey);

// Receive and decrypt
const decrypted = handler.receiveMessage(encrypted, 'bob');
console.log(decrypted.plaintext); // "Secret message"
```

## API Reference

### Key Generation

```typescript
// Generate a new X25519 key pair
const keyPair = await generateKeyPair();
// { publicKey: Uint8Array, privateKey: Uint8Array }

// Validate a key pair
const isValid = validateKeyPair(keyPair); // boolean
```

### Key Exchange (ECDH)

```typescript
// Perform ECDH key exchange
const exchange = performKeyExchange(
  ownPrivateKey,      // Your private key
  otherPublicKey,     // Recipient's public key
  senderPublicKey,    // Your public key
  recipientPublicKey  // Recipient's public key
);
// { sharedSecret: Uint8Array, senderPublicKey, recipientPublicKey }
```

### Key Derivation (HKDF)

```typescript
// Derive session key from shared secret
const sessionKey = deriveSessionKey(sharedSecret);
// { key: Uint8Array, algorithm: 'AES-256-GCM' }
```

### Encryption/Decryption

```typescript
// Encrypt a message
const encrypted = encrypt(
  plaintext,          // string or Uint8Array
  sessionKey,         // 32-byte key
  senderPublicKey,
  recipientPublicKey
);
// { ciphertext, nonce, authTag, senderPublicKey, recipientPublicKey }

// Decrypt a message
const plaintext = decrypt(encrypted, sessionKey);
```

### Key Storage

```typescript
// Set master key for private key encryption
keyStore.setMasterKey(masterKey);

// Store a key pair
keyStore.storeKeyPair(userId, keyPair);

// Retrieve a key pair
const keyPair = keyStore.getKeyPair(userId);

// Get only public key
const publicKey = keyStore.getPublicKey(userId);
```

## Security Considerations

1. **Forward Secrecy**: Each conversation derives a unique session key. Compromised session keys don't reveal past messages.

2. **Key Storage**: Private keys should be stored encrypted. Use `keyStore.setMasterKey()` to enable encryption.

3. **Nonce Uniqueness**: Each message uses a fresh nonce to prevent replay attacks.

4. **Authentication**: AES-256-GCM provides built-in authentication. Tampered messages are rejected.

5. **Private Key Security**: Private keys never leave the device. Only public keys are transmitted.

## Running Tests

```bash
npm test
```

## Running the Demo

```bash
npm run dev
```

## Project Structure

```
src/
├── crypto/
│   ├── keyGeneration.ts    # X25519 key pair generation
│   ├── keyExchange.ts      # ECDH key exchange
│   ├── keyDerivation.ts    # HKDF session key derivation
│   ├── encryption.ts       # AES-256-GCM encryption/decryption
│   └── keyStorage.ts       # Secure key storage
├── messaging/
│   └── messageHandler.ts   # High-level message API
├── types/
│   └── crypto.ts           # TypeScript type definitions
├── utils/
│   └── encoding.ts         # Base64/Hex encoding utilities
├── __tests__/
│   └── crypto.test.ts      # Comprehensive test suite
└── demo.ts                 # Interactive demo script
```

## Tech Stack

- **TypeScript**: Type-safe implementation
- **libsodium.js**: Cryptographic primitives
- **Vitest**: Testing framework

## License

MIT