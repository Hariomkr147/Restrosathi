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
    // Flip a byte in the first chunk's ciphertext (offset: 10 (magic) + 4 (len) + 12 (iv) = 26)
    encrypted[26] ^= 1;

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
    const truncated = encrypted.subarray(0, encrypted.length - 2); // missing end marker or tag bytes

    const dec = new DecryptStream(KEY);
    const encStr = new Readable({
      read() {
        this.push(truncated);
        this.push(null);
      }
    });

    await expect(streamToBuffer(encStr.pipe(dec))).rejects.toThrow(/missing final chunk marker/);
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
});
