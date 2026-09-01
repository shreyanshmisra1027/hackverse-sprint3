import type { VercelRequest, VercelResponse } from "@vercel/node";
import { currentUser, database, json, methodNotAllowed } from "./_lib.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") return methodNotAllowed(response, "POST");
  try {
    const user = await currentUser(request);
    if (!user) return json(response, 401, { error: "Sign in required." });
    await database().query("UPDATE users SET last_seen_at = now() WHERE id = $1", [user.id]);
    return json(response, 204, null);
  } catch (error) {
    console.error("presence update failed", error);
    return json(response, 500, { error: "Unable to update presence." });
  }
}
