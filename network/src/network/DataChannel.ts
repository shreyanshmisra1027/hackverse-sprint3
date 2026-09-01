import { ChunkHeader, CHUNK_SIZE, BACKPRESSURE_HIGH_WATER, BACKPRESSURE_LOW_WATER } from "./protocol";

interface IncomingTransfer { header: ChunkHeader; chunks: ArrayBuffer[]; receivedBytes: number; startedAt: number; }
interface KeyExchangeMessage { kind: "inevitable-key"; publicKey: string; }
export interface TransferProgress { transferId: string; fileName: string; bytesTransferred: number; totalBytes: number; percent: number; speedKBs: number; }

/**
 * WebRTC already encrypts transport with DTLS. This wrapper additionally uses a
 * fresh ECDH P-256 key exchange per data channel and AES-256-GCM per chunk, so
 * file names, metadata, and file bytes are encrypted together.
 */
export class DataChannelWrapper {
  private channel: RTCDataChannel | null = null;
  private incoming = new Map<string, IncomingTransfer>();
  private sendQueue: (() => void)[] = [];
  private draining = false;
  private localKeyPair: CryptoKeyPair | null = null;
  private remotePublicKey: ArrayBuffer | null = null;
  private transferKey: CryptoKey | null = null;
  private keyReady: Promise<void> | null = null;
  private resolveKeyReady: (() => void) | null = null;
  private applicationEncryption = false;
  private pendingPlainHeader: ChunkHeader | null = null;

  onProgress?: (p: TransferProgress) => void;
  onFileComplete?: (fileName: string, data: Blob) => void;
  onOpen?: () => void;
  onSecureReady?: () => void;
  onClose?: () => void;

  attach(channel: RTCDataChannel): void {
    this.channel = channel;
    this.resetCrypto();
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = BACKPRESSURE_LOW_WATER;
    channel.onopen = () => {
      this.onOpen?.();
      // WebRTC always encrypts the transport with DTLS. The optional second
      // layer needs Web Crypto, which browsers expose only in secure contexts.
      this.applicationEncryption = window.isSecureContext && !!crypto.subtle;
      if (this.applicationEncryption) void this.beginKeyExchange();
      else this.resolveKeyReady?.();
    };
    channel.onclose = () => this.onClose?.();
    channel.onbufferedamountlow = () => this.drainQueue();
    channel.onmessage = (event) => {
      if (typeof event.data === "string") this.handleTextMessage(event.data);
      else if (this.applicationEncryption) void this.handleEncryptedChunk(event.data as ArrayBuffer);
      else if (this.pendingPlainHeader) {
        this.handleChunk(this.pendingPlainHeader, event.data as ArrayBuffer);
        this.pendingPlainHeader = null;
      }
    };
  }

  async sendFile(file: File, transferId: string): Promise<void> {
    if (!this.channel || this.channel.readyState !== "open") throw new Error("DataChannel not open");
    if (this.applicationEncryption) await this.waitForEncryption();
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const startedAt = Date.now();
    let sentBytes = 0;
    for (let index = 0; index < totalChunks; index++) {
      const buffer = await file.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE).arrayBuffer();
      const header: ChunkHeader = { transferId, fileName: file.name, fileSize: file.size, mimeType: file.type || "application/octet-stream", chunkIndex: index, totalChunks, chunkSize: buffer.byteLength };
      if (this.applicationEncryption) {
        await this.sendWithBackpressure(await this.encryptChunk(header, buffer));
      } else {
        await this.sendWithBackpressure(JSON.stringify(header));
        await this.sendWithBackpressure(buffer);
      }
      sentBytes += buffer.byteLength;
      const elapsedS = (Date.now() - startedAt) / 1000 || 0.001;
      this.onProgress?.({ transferId, fileName: file.name, bytesTransferred: sentBytes, totalBytes: file.size, percent: file.size === 0 ? 100 : Math.round((sentBytes / file.size) * 100), speedKBs: sentBytes / 1024 / elapsedS });
    }
  }

  private resetCrypto(): void {
    this.localKeyPair = null; this.remotePublicKey = null; this.transferKey = null;
    this.applicationEncryption = false; this.pendingPlainHeader = null;
    this.keyReady = new Promise((resolve) => (this.resolveKeyReady = resolve));
  }

  private async beginKeyExchange(): Promise<void> {
    try {
      this.localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
      const publicKey = await crypto.subtle.exportKey("raw", this.localKeyPair.publicKey);
      this.channel?.send(JSON.stringify({ kind: "inevitable-key", publicKey: this.toBase64(publicKey) } satisfies KeyExchangeMessage));
      await this.deriveTransferKey();
    } catch (error) { console.error("[DataChannel] key exchange failed", error); }
  }

  private handleTextMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as KeyExchangeMessage | ChunkHeader;
      if ("kind" in message && message.kind === "inevitable-key" && message.publicKey) {
        this.remotePublicKey = this.fromBase64(message.publicKey);
        void this.deriveTransferKey();
      } else if (!this.applicationEncryption && "transferId" in message && "chunkIndex" in message) {
        this.pendingPlainHeader = message as ChunkHeader;
      }
    } catch { console.warn("[DataChannel] ignored malformed control message"); }
  }

  private async deriveTransferKey(): Promise<void> {
    if (this.transferKey || !this.localKeyPair || !this.remotePublicKey) return;
    const remoteKey = await crypto.subtle.importKey("raw", this.remotePublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
    this.transferKey = await crypto.subtle.deriveKey({ name: "ECDH", public: remoteKey }, this.localKeyPair.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    this.resolveKeyReady?.(); this.resolveKeyReady = null; this.onSecureReady?.();
  }

  private async waitForEncryption(): Promise<void> {
    if (this.transferKey) return;
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Encryption handshake timed out")), 10_000));
    await Promise.race([this.keyReady!, timeout]);
  }

  private async encryptChunk(header: ChunkHeader, bytes: ArrayBuffer): Promise<ArrayBuffer> {
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const plain = new Uint8Array(4 + headerBytes.length + bytes.byteLength);
    new DataView(plain.buffer).setUint32(0, headerBytes.length); plain.set(headerBytes, 4); plain.set(new Uint8Array(bytes), 4 + headerBytes.length);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.transferKey!, plain);
    const packet = new Uint8Array(iv.length + ciphertext.byteLength); packet.set(iv); packet.set(new Uint8Array(ciphertext), iv.length);
    return packet.buffer;
  }

  private async handleEncryptedChunk(packet: ArrayBuffer): Promise<void> {
    try {
      await this.waitForEncryption();
      const data = new Uint8Array(packet);
      if (data.byteLength <= 12) throw new Error("Encrypted packet is too short");
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, this.transferKey!, data.slice(12));
      const plain = new Uint8Array(plaintext);
      const headerLength = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0);
      if (headerLength <= 0 || headerLength > plain.byteLength - 4) throw new Error("Invalid encrypted header");
      const header = JSON.parse(new TextDecoder().decode(plain.slice(4, 4 + headerLength))) as ChunkHeader;
      this.handleChunk(header, plain.slice(4 + headerLength).buffer);
    } catch (error) { console.error("[DataChannel] could not decrypt received chunk", error); }
  }

  private sendWithBackpressure(packet: ArrayBuffer | string): Promise<void> {
    return new Promise((resolve) => {
      const send = () => {
        if (typeof packet === "string") this.channel!.send(packet);
        else this.channel!.send(packet);
        resolve();
      };
      if (this.channel!.bufferedAmount > BACKPRESSURE_HIGH_WATER) this.sendQueue.push(send); else send();
    });
  }

  private drainQueue(): void {
    if (this.draining) return;
    this.draining = true;
    while (this.sendQueue.length && this.channel && this.channel.bufferedAmount <= BACKPRESSURE_LOW_WATER) this.sendQueue.shift()!();
    this.draining = false;
  }

  private handleChunk(header: ChunkHeader, buffer: ArrayBuffer): void {
    let transfer = this.incoming.get(header.transferId);
    if (!transfer) { transfer = { header, chunks: new Array(header.totalChunks), receivedBytes: 0, startedAt: Date.now() }; this.incoming.set(header.transferId, transfer); }
    if (header.chunkIndex < 0 || header.chunkIndex >= header.totalChunks || transfer.chunks[header.chunkIndex]) return;
    transfer.chunks[header.chunkIndex] = buffer; transfer.receivedBytes += buffer.byteLength;
    const elapsedS = (Date.now() - transfer.startedAt) / 1000 || 0.001;
    this.onProgress?.({ transferId: header.transferId, fileName: header.fileName, bytesTransferred: transfer.receivedBytes, totalBytes: header.fileSize, percent: header.fileSize === 0 ? 100 : Math.round((transfer.receivedBytes / header.fileSize) * 100), speedKBs: transfer.receivedBytes / 1024 / elapsedS });
    if (transfer.receivedBytes >= header.fileSize && transfer.chunks.every(Boolean)) { this.onFileComplete?.(header.fileName, new Blob(transfer.chunks, { type: header.mimeType })); this.incoming.delete(header.transferId); }
  }

  private toBase64(bytes: ArrayBuffer): string { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
  private fromBase64(value: string): ArrayBuffer { const binary = atob(value); return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer; }
  get bufferedAmount(): number { return this.channel?.bufferedAmount ?? 0; }
  get readyState(): RTCDataChannelState | "unavailable" { return this.channel?.readyState ?? "unavailable"; }
  close(): void { this.channel?.close(); this.channel = null; this.incoming.clear(); this.sendQueue = []; this.resetCrypto(); }
}
