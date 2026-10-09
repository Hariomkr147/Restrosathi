import { describe, it, expect } from "vitest";
import { EncryptStream, DecryptStream } from "./crypto";
import crypto from "crypto";
import { pipeline } from "stream/promises";
import { Readable, Writable } from "stream";

const KEY = crypto.randomBytes(32).toString("base64");
const WRONG_KEY = crypto.randomBytes(32).toString("base64");

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

describe("Backup Crypto", () => {
  const roundtrip = async (input: Buffer, key = KEY, decryptKey = KEY) => {
    const enc = new EncryptStream(key);
    const dec = new DecryptStream(decryptKey);
    
    const inputStr = new Readable({
      read() {
        this.push(input);
        this.push(null);
      }
    });

    const outChunks: Buffer[] = [];
    const outStr = new Writable({
      write(chunk, encoding, callback) {
        outChunks.push(chunk);
        callback();
      }
    });

    await pipeline(inputStr, enc, dec, outStr);
    return Buffer.concat(outChunks);
  };

  it("roundtrips 0 bytes", async () => {
    const input = Buffer.alloc(0);
    const out = await roundtrip(input);
    expect(out.equals(input)).toBe(true);
  });

  it("roundtrips 1 byte", async () => {
    const input = Buffer.from("A");
    const out = await roundtrip(input);
    expect(out.equals(input)).toBe(true);
  });

  it("roundtrips 1 MiB - 1", async () => {
    const input = crypto.randomBytes(1024 * 1024 - 1);
    const out = await roundtrip(input);
    expect(out.equals(input)).toBe(true);
  });

  it("roundtrips exactly 1 MiB", async () => {
    const input = crypto.randomBytes(1024 * 1024);
    const out = await roundtrip(input);
    expect(out.equals(input)).toBe(true);
  });

  it("roundtrips a 50 MiB stream", async () => {
    const enc = new EncryptStream(KEY);
    const dec = new DecryptStream(KEY);
    
    const hashIn = crypto.createHash("sha256");
    const hashOut = crypto.createHash("sha256");

    let generated = 0;
    const size = 50 * 1024 * 1024;
    const chunkSize = 64 * 1024;

    const inputStr = new Readable({
      read() {
        if (generated >= size) {
          this.push(null);
          return;
        }
        const toGen = Math.min(chunkSize, size - generated);
        const buf = crypto.randomBytes(toGen);
        hashIn.update(buf);
        generated += toGen;
        this.push(buf);
      }
    });

    const outStr = new Writable({
      write(chunk, encoding, callback) {
        hashOut.update(chunk);
        callback();
      }
    });

    await pipeline(inputStr, enc, dec, outStr);
    expect(hashIn.digest("hex")).toEqual(hashOut.digest("hex"));
  });

  it("fails with wrong key", async () => {
    const input = Buffer.from("Hello world");
    await expect(roundtrip(input, KEY, WRONG_KEY)).rejects.toThrow(/Decryption failed/);
  });

  it("fails if a ciphertext byte is flipped", async () => {
    const input = Buffer.from("Sensitive data");
    const enc = new EncryptStream(KEY);
    
    const inputStr = new Readable({
      read() {
        this.push(input);
        this.push(null);
      }
    });

    const encrypted = await streamToBuffer(inputStr.pipe(enc));
    // Header V2: 10 bytes magic + 32 bytes fileId = 42 bytes. Then chunk.
    // Chunk: 4 bytes length, 12 bytes IV, ciphertext (len bytes), 16 bytes tag.
    // Total offset to ciphertext = 42 + 4 + 12 = 58
    encrypted[58] ^= 1;

    const dec = new DecryptStream(KEY);
    const encStr = new Readable({
      read() {
        this.push(encrypted);
        this.push(null);
      }
    });

    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/Decryption failed/);
  });

  it("fails if file is truncated", async () => {
    const input = Buffer.from("Sensitive data");
    const enc = new EncryptStream(KEY);
    
    const inputStr = new Readable({
      read() {
        this.push(input);
        this.push(null);
      }
    });

    const encrypted = await streamToBuffer(inputStr.pipe(enc));
    const truncated = encrypted.subarray(0, encrypted.length - 2); // missing tag bytes

    const dec = new DecryptStream(KEY);
    const encStr = new Readable({
      read() {
        this.push(truncated);
        this.push(null);
      }
    });

    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/Unexpected end of stream/);
  });

  it("fails if data is appended", async () => {
    const input = Buffer.from("Sensitive data");
    const enc = new EncryptStream(KEY);
    const inputStr = new Readable({ read() { this.push(input); this.push(null); } });
    
    const encrypted = await streamToBuffer(inputStr.pipe(enc));
    const appended = Buffer.concat([encrypted, Buffer.from("extra bytes")]);
    
    const dec = new DecryptStream(KEY);
    const encStr = new Readable({ read() { this.push(appended); this.push(null); } });
    
    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/Data appended after end marker|Trailing data/);
  });

  it("two encryptions of the same input differ", async () => {
    const input = Buffer.from("Hello world");
    
    const enc1 = new EncryptStream(KEY);
    const inputStr1 = new Readable({ read() { this.push(input); this.push(null); } });
    const out1 = await streamToBuffer(inputStr1.pipe(enc1));

    const enc2 = new EncryptStream(KEY);
    const inputStr2 = new Readable({ read() { this.push(input); this.push(null); } });
    const out2 = await streamToBuffer(inputStr2.pipe(enc2));

    expect(out1.equals(out2)).toBe(false);
  });

  // V2 Specific security tests

  const parseV2Chunks = (buf: Buffer) => {
    const header = buf.subarray(0, 42); // 10 magic + 32 fileId
    let offset = 42;
    const chunks: Buffer[] = [];
    while (offset < buf.length) {
      const len = buf.readUInt32BE(offset);
      const chunkLen = 4 + 12 + len + 16;
      chunks.push(buf.subarray(offset, offset + chunkLen));
      offset += chunkLen;
    }
    return { header, chunks };
  };

  it("fails if chunks are reordered", async () => {
    const input = crypto.randomBytes(2 * 1024 * 1024 + 100); // 3 data chunks (2 full, 1 partial) + 1 final
    const enc = new EncryptStream(KEY);
    const inputStr = new Readable({ read() { this.push(input); this.push(null); } });
    const encrypted = await streamToBuffer(inputStr.pipe(enc));

    const { header, chunks } = parseV2Chunks(encrypted);
    
    // Swap chunk 0 and chunk 1
    const reordered = Buffer.concat([
      header,
      chunks[1],
      chunks[0],
      chunks[2],
      chunks[3] // final
    ]);

    const dec = new DecryptStream(KEY);
    const encStr = new Readable({ read() { this.push(reordered); this.push(null); } });
    
    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/Decryption failed/);
  });

  it("fails if chunks are cross-spliced from another file", async () => {
    const input = crypto.randomBytes(2 * 1024 * 1024 + 100);
    
    // File A
    const encA = new EncryptStream(KEY);
    const inputStrA = new Readable({ read() { this.push(input); this.push(null); } });
    const encryptedA = await streamToBuffer(inputStrA.pipe(encA));
    const partsA = parseV2Chunks(encryptedA);

    // File B
    const encB = new EncryptStream(KEY);
    const inputStrB = new Readable({ read() { this.push(input); this.push(null); } });
    const encryptedB = await streamToBuffer(inputStrB.pipe(encB));
    const partsB = parseV2Chunks(encryptedB);

    // Replace chunk 0 in A with chunk 0 from B
    const spliced = Buffer.concat([
      partsA.header,
      partsB.chunks[0],
      partsA.chunks[1],
      partsA.chunks[2],
      partsA.chunks[3] // final
    ]);

    const dec = new DecryptStream(KEY);
    const encStr = new Readable({ read() { this.push(spliced); this.push(null); } });
    
    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/Decryption failed/);
  });

  it("fails on duplicate frames", async () => {
    const input = crypto.randomBytes(1024 * 1024 + 100); // 2 data chunks + 1 final
    const enc = new EncryptStream(KEY);
    const inputStr = new Readable({ read() { this.push(input); this.push(null); } });
    const encrypted = await streamToBuffer(inputStr.pipe(enc));

    const { header, chunks } = parseV2Chunks(encrypted);
    
    // Duplicate chunk 0
    const duplicated = Buffer.concat([
      header,
      chunks[0],
      chunks[0], // duplicated
      chunks[1],
      chunks[2] // final
    ]);

    const dec = new DecryptStream(KEY);
    const encStr = new Readable({ read() { this.push(duplicated); this.push(null); } });
    
    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/Decryption failed/);
  });

  it("fails if final marker appears early", async () => {
    const input = crypto.randomBytes(2 * 1024 * 1024 + 100);
    const enc = new EncryptStream(KEY);
    const inputStr = new Readable({ read() { this.push(input); this.push(null); } });
    const encrypted = await streamToBuffer(inputStr.pipe(enc));

    const { header, chunks } = parseV2Chunks(encrypted);
    
    // Put final marker early (replace chunk 1)
    const earlyFinal = Buffer.concat([
      header,
      chunks[0],
      chunks[3], // final chunk
      chunks[1],
      chunks[2]
    ]);

    const dec = new DecryptStream(KEY);
    const encStr = new Readable({ read() { this.push(earlyFinal); this.push(null); } });
    
    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/Data appended after end marker|Decryption failed/);
  });
});
