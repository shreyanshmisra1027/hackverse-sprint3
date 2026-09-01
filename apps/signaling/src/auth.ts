import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL = /^[A-Za-z0-9._%+-]+@vitstudent\.ac\.in$/i;
const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;

export class AuthError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
export type Account = { id: string; email: string; username: string; verified: boolean };

export class AuthStore {
  private readonly pool: Pool;
  private ready?: Promise<void>;

  constructor(private readonly env = process.env) {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL must be configured for account authentication.");
    this.pool = new Pool({ connectionString: env.DATABASE_URL, ssl: env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false } });
  }

  private async init() {
    if (!this.ready) this.ready = this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, verified BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS pending_signups (email TEXT PRIMARY KEY, username TEXT NOT NULL, password_hash TEXT NOT NULL, otp_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
    `).then(() => undefined);
    return this.ready;
  }

  async requestSignup(email: string, username: string, password: string) {
    email = email.toLowerCase(); username = username.trim();
    if (!EMAIL.test(email)) throw new AuthError("Use a valid @vitstudent.ac.in email address.");
    if (!USERNAME.test(username)) throw new AuthError("Username must be 3–32 letters, numbers, hyphens, or underscores.");
    if (password.length < 12) throw new AuthError("Use a password with at least 12 characters.");
    await this.init();
    const exists = await this.pool.query("SELECT 1 FROM users WHERE email = $1 OR username = $2", [email, username]);
    if (exists.rowCount) throw new AuthError("An account with that email or username already exists.", 409);
    const result = await this.pool.query<Account>("INSERT INTO users (id, email, username, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, email, username, verified", [randomUUID(), email, username, await hash(password)]);
    return this.createSession(result.rows[0]);
  }

  async login(email: string, password: string) {
    await this.init();
    const result = await this.pool.query<Account & { password_hash: string }>("SELECT id, email, username, verified, password_hash FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await verify(password, user.password_hash))) throw new AuthError("Email or password is incorrect.", 401);
    return this.createSession(user);
  }

  async accountForToken(token: string | undefined): Promise<Account | null> {
    if (!token) return null; await this.init();
    const result = await this.pool.query<Account>("SELECT u.id, u.email, u.username, u.verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()", [digest(token)]);
    return result.rows[0] ?? null;
  }

  private async createSession(user: Account) {
    const token = randomBytes(32).toString("base64url");
    await this.pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,now() + interval '30 days')", [digest(token), user.id]);
    return { user, token, expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() };
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function hash(value: string) { const salt = randomBytes(16).toString("hex"); return `${salt}:${Buffer.from(await scrypt(value, salt, 64) as ArrayBuffer).toString("hex")}`; }
async function verify(value: string, encoded: string) { const [salt, expected] = encoded.split(":"); if (!salt || !expected) return false; const actual = Buffer.from(await scrypt(value, salt, 64) as ArrayBuffer); const wanted = Buffer.from(expected, "hex"); return actual.length === wanted.length && timingSafeEqual(actual, wanted); }
