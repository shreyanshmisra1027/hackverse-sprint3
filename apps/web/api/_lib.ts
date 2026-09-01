import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

export type PublicUser = { id: string; email: string; username: string };

let pool: Pool | undefined;
let initialized: Promise<void> | undefined;

export class ServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}

function database(): Pool {
  if (!process.env.DATABASE_URL) throw new ServiceConfigurationError("DATABASE_URL is not configured.");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5, ssl: { rejectUnauthorized: false } });
  return pool;
}

export async function initialize(): Promise<void> {
  if (!initialized) {
    const setup = database().query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
      CREATE TABLE IF NOT EXISTS message_archive (
        id UUID PRIMARY KEY,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_username TEXT NOT NULL,
        room_id TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS message_archive_sender_created_idx ON message_archive(sender_id, created_at DESC);
    `).then(() => undefined);
    // Do not cache a rejected startup attempt: a transient database/network
    // failure should not make every later request fail in this function instance.
    initialized = setup.catch((error) => {
      initialized = undefined;
      throw error;
    });
  }
  return initialized;
}

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function issueSession(user: PublicUser): Promise<{ token: string; user: PublicUser; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await database().query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [digest(token), user.id, expiresAt]);
  return { token, user, expiresAt: expiresAt.toISOString() };
}

export async function currentUser(request: VercelRequest): Promise<PublicUser | null> {
  const header = request.headers.authorization;
  const token = typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : "";
  if (!token) return null;
  await initialize();
  const result = await database().query<PublicUser>(
    `SELECT u.id, u.email, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [digest(token)]
  );
  return result.rows[0] ?? null;
}

export function json(response: VercelResponse, status: number, payload: unknown): void {
  response.status(status).json(payload);
}

export function methodNotAllowed(response: VercelResponse, allowed: string): void {
  response.setHeader("Allow", allowed);
  json(response, 405, { error: "Method not allowed" });
}

export function encryptionKey(): Uint8Array {
  const encoded = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MESSAGE_ENCRYPTION_KEY is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("MESSAGE_ENCRYPTION_KEY must be a base64-encoded 32-byte value.");
  return new Uint8Array(key);
}

export function encryptMessage(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
  const iv = new Uint8Array(randomBytes(12));
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = cipher.update(plaintext, "utf8", "base64") + cipher.final("base64");
  return { ciphertext, iv: Buffer.from(iv).toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptMessage(row: { ciphertext: string; iv: string; auth_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), new Uint8Array(Buffer.from(row.iv, "base64")));
  decipher.setAuthTag(new Uint8Array(Buffer.from(row.auth_tag, "base64")));
  return decipher.update(row.ciphertext, "base64", "utf8") + decipher.final("utf8");
}

export { bcrypt, database, randomUUID };
