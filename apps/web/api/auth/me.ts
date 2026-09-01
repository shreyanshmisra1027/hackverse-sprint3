import type { VercelRequest, VercelResponse } from "@vercel/node";
import { currentUser, json, methodNotAllowed } from "../_lib";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "GET") return methodNotAllowed(response, "GET");
  try { return json(response, 200, { user: await currentUser(request) }); }
  catch (error) { console.error("session lookup failed", error); return json(response, 500, { error: "Unable to load session." }); }
}
