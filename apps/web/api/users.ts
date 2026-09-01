import type { VercelRequest, VercelResponse } from "@vercel/node";
import { currentUser, database, initialize, json, methodNotAllowed } from "./_lib.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "GET") return methodNotAllowed(response, "GET");
  try {
    const user = await currentUser(request);
    if (!user) return json(response, 401, { error: "Sign in required." });
    const result = await database().query<{ username: string; online: boolean }>(
      "SELECT username, last_seen_at > now() - interval '45 seconds' AS online FROM users WHERE id <> $1 ORDER BY username ASC LIMIT 100",
      [user.id],
    );
    return json(response, 200, { users: result.rows });
  } catch (error) {
    console.error("user directory failed", error);
    return json(response, 500, { error: "Unable to load students." });
  }
}
