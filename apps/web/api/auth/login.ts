import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bcrypt, database, initialize, issueSession, json, methodNotAllowed } from "../_lib.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") return methodNotAllowed(response, "POST");
  try {
    const { email = "", password = "" } = request.body ?? {};
    await initialize();
    const result = await database().query("SELECT id, email, username, password_hash FROM users WHERE email = $1", [String(email).trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || typeof password !== "string" || !(await bcrypt.compare(password, user.password_hash))) return json(response, 401, { error: "Email or password is incorrect." });
    return json(response, 200, await issueSession(user));
  } catch (error) {
    console.error("login failed", error);
    return json(response, 500, { error: "Unable to sign in." });
  }
}
