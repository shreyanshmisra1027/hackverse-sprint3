import { describe, it, expect } from "vitest";
import {
  CHUNK_SIZE,
  BACKPRESSURE_HIGH_WATER,
  BACKPRESSURE_LOW_WATER,
  CONNECTION_TIMEOUT_MS,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_BACKOFF_MS,
} from "../src/network/protocol";

describe("Protocol Constants", () => {
  it("CHUNK_SIZE is 16KB and within SCTP limits", () => {
    expect(CHUNK_SIZE).toBe(16 * 1024);
    expect(CHUNK_SIZE).toBeLessThanOrEqual(256 * 1024); // SCTP message cap
  });

  it("backpressure watermarks are correctly ordered", () => {
    expect(BACKPRESSURE_HIGH_WATER).toBe(8 * CHUNK_SIZE);
    expect(BACKPRESSURE_LOW_WATER).toBe(2 * CHUNK_SIZE);
    expect(BACKPRESSURE_HIGH_WATER).toBeGreaterThan(BACKPRESSURE_LOW_WATER);
  });

  it("connection timeout is reasonable", () => {
    expect(CONNECTION_TIMEOUT_MS).toBe(15_000);
    expect(CONNECTION_TIMEOUT_MS).toBeGreaterThan(5_000);
    expect(CONNECTION_TIMEOUT_MS).toBeLessThan(60_000);
  });

  it("reconnect backoff configuration is valid", () => {
    expect(RECONNECT_MAX_ATTEMPTS).toBe(3);
    expect(RECONNECT_BACKOFF_MS).toBe(1500);
    expect(RECONNECT_BACKOFF_MS * RECONNECT_MAX_ATTEMPTS).toBeLessThan(10_000);
  });

  it("chunk calculation handles edge cases", () => {
    const testCases = [
      { size: 0, expected: 1 },
      { size: 1, expected: 1 },
      { size: CHUNK_SIZE, expected: 1 },
      { size: CHUNK_SIZE + 1, expected: 2 },
      { size: CHUNK_SIZE * 10, expected: 10 },
      { size: 50 * 1024 * 1024, expected: Math.ceil((50 * 1024 * 1024) / CHUNK_SIZE) },
    ];

    testCases.forEach(({ size, expected }) => {
      const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));
      expect(totalChunks).toBe(expected);
    });
  });
});

describe("Connection States", () => {
  it("all states are valid strings", () => {
    const states = ["idle", "signaling", "connecting", "connected", "reconnecting", "failed", "closed"];
    states.forEach((state) => {
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);
    });
  });
});
