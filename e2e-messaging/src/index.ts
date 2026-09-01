/**
 * E2E Messaging Encryption System
 * Main entry point for the encryption library
 */

// Core cryptographic modules
export * from './crypto/keyGeneration.js';
export * from './crypto/keyExchange.js';
export * from './crypto/keyDerivation.js';
export * from './crypto/encryption.js';
export * from './crypto/keyStorage.js';

// Type definitions
export * from './types/crypto.js';

// Message handling
export { MessageHandler, messageHandler } from './messaging/messageHandler.js';

// Utility functions
export * from './utils/encoding.js';

// Re-export for convenience
export { keyStore } from './crypto/keyStorage.js';
