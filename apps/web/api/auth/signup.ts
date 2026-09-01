import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bcrypt, database, initialize, issueSession, json, methodNotAllowed, randomUUID, ServiceConfigurationError } from "../_lib.js";

const EMAIL = /^[A-Za-z0-9._%+-]+@vitstudent\.ac\.in$/i;
const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") return methodNotAllowed(response, "POST");
  try {
    const { email = "", username = "", password = "" } = request.body ?? {};
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = String(username).trim();
    if (!EMAIL.test(cleanEmail)) return json(response, 400, { error: "Use a valid @vitstudent.ac.in email address." });
    if (!USERNAME.test(cleanUsername)) return json(response, 400, { error: "Username must be 3–32 letters, numbers, hyphens, or underscores." });
    if (typeof password !== "string" || password.length < 12) return json(response, 400, { error: "Use a password with at least 12 characters." });
    await initialize();
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await database().query(
      "INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, username",
      [randomUUID(), cleanEmail, cleanUsername, passwordHash]
    );
    return json(response, 201, await issueSession(created.rows[0]));
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "23505") return json(response, 409, { error: "An account with that email or username already exists." });
    if (error instanceof ServiceConfigurationError) {
      console.error("signup service configuration failed", error);
      return json(response, 503, { error: "Authentication is temporarily unavailable. The server needs its DATABASE_URL configured." });
    }
    console.error("signup failed", error);
    return json(response, 500, { error: "Unable to create account." });
  }
}
