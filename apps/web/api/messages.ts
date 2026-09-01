import type { VercelRequest, VercelResponse } from "@vercel/node";
import { currentUser, database, decryptMessage, encryptMessage, initialize, json, methodNotAllowed, randomUUID } from "./_lib.js";

const ROOM = /^[A-Za-z0-9_-]{3,64}$/;
const USERNAME = /^@[A-Za-z0-9_-]{1,32}$/;
const MAX_MESSAGE_LENGTH = 10_000;

export default async function handler(request: VercelRequest, response: VercelResponse) {
  try {
    if (request.method !== "POST" && request.method !== "GET") return methodNotAllowed(response, "GET, POST");
    const user = await currentUser(request);
    if (!user) return json(response, 401, { error: "Sign in required." });
    if (request.method === "POST") {
      const { roomId = "", recipientUsername = "", text = "", outgoing = true } = request.body ?? {};
      if (!ROOM.test(String(roomId)) || !USERNAME.test(String(recipientUsername)) || typeof text !== "string" || !text.trim() || text.length > MAX_MESSAGE_LENGTH) return json(response, 400, { error: "Invalid message payload." });
      const encrypted = encryptMessage(text);
      await database().query(
        `INSERT INTO message_archive (id, sender_id, recipient_username, room_id, ciphertext, iv, auth_tag, outgoing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), user.id, recipientUsername, roomId, encrypted.ciphertext, encrypted.iv, encrypted.authTag, Boolean(outgoing)]
      );
      return json(response, 201, { saved: true });
    }
    const result = await database().query(
      `SELECT id, recipient_username, room_id, ciphertext, iv, auth_tag, outgoing, created_at
       FROM message_archive WHERE sender_id = $1 ORDER BY created_at DESC LIMIT 100`, [user.id]
    );
    return json(response, 200, { messages: result.rows.map((row) => ({ id: row.id, recipientUsername: row.recipient_username, roomId: row.room_id, text: decryptMessage(row), outgoing: row.outgoing, createdAt: row.created_at })) });
  } catch (error) {
    console.error("message archive failed", error);
    return json(response, 500, { error: "Unable to access message archive." });
  }
}
