import { Transform } from "stream";
import crypto from "crypto";

const MAGIC = Buffer.from("RS_BACKUP\x01");
const CHUNK_SIZE = 1024 * 1024; // 1 MiB

export class EncryptStream extends Transform {
  private key: Buffer;
  private buffer: Buffer = Buffer.alloc(0);
  private headerWritten = false;

  constructor(keyBase64: string) {
    super();
    this.key = Buffer.from(keyBase64, "base64");
    if (this.key.length !== 32) throw new Error("Key must be exactly 32 bytes");
  }

  _transform(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    
    if (!this.headerWritten) {
      this.push(MAGIC);
      this.headerWritten = true;
    }

    while (this.buffer.length >= CHUNK_SIZE) {
      const chunkToEncrypt = this.buffer.subarray(0, CHUNK_SIZE);
      this.buffer = this.buffer.subarray(CHUNK_SIZE);
      this._encryptChunk(chunkToEncrypt);
    }
    
    callback();
  }

  _flush(callback: (error?: Error | null) => void) {
    if (!this.headerWritten) {
      this.push(MAGIC);
    }
    if (this.buffer.length > 0) {
      this._encryptChunk(this.buffer);
    }
    
    // Write an end marker: length 0
    const endMarker = Buffer.alloc(4);
    endMarker.writeUInt32BE(0, 0);
    this.push(endMarker);
    
    callback();
  }

  private _encryptChunk(data: Buffer) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    
    this.push(Buffer.concat([lenBuf, iv, ciphertext, tag]));
  }
}

export class DecryptStream extends Transform {
  private key: Buffer;
  private buffer: Buffer = Buffer.alloc(0);
  private headerRead = false;
  private isDone = false;

  constructor(keyBase64: string) {
    super();
    this.key = Buffer.from(keyBase64, "base64");
    if (this.key.length !== 32) throw new Error("Key must be exactly 32 bytes");
  }

  _transform(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
    if (this.isDone) return callback(new Error("Data appended after end marker"));
    
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (!this.headerRead) {
      if (this.buffer.length < MAGIC.length) return callback();
      const header = this.buffer.subarray(0, MAGIC.length);
      if (!header.equals(MAGIC)) {
        return callback(new Error("Invalid magic header"));
      }
      this.buffer = this.buffer.subarray(MAGIC.length);
      this.headerRead = true;
    }

    try {
      while (true) {
        if (this.buffer.length < 4) break;
        const len = this.buffer.readUInt32BE(0);
        
        if (len === 0) {
          this.isDone = true;
          this.buffer = this.buffer.subarray(4);
          break;
        }

        const chunkTotalLen = 4 + 12 + len + 16;
        if (this.buffer.length < chunkTotalLen) break;

        const iv = this.buffer.subarray(4, 4 + 12);
        const ciphertext = this.buffer.subarray(4 + 12, 4 + 12 + len);
        const tag = this.buffer.subarray(4 + 12 + len, chunkTotalLen);

        const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
        decipher.setAuthTag(tag);
        
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        this.push(decrypted);

        this.buffer = this.buffer.subarray(chunkTotalLen);
      }
      callback();
    } catch (err: any) {
      callback(new Error("Decryption failed: " + err.message));
    }
  }

  _flush(callback: (error?: Error | null) => void) {
    if (!this.isDone) {
      return callback(new Error("Unexpected end of stream, missing final chunk marker"));
    }
    if (this.buffer.length > 0) {
      return callback(new Error("Trailing data after end marker"));
    }
    callback();
  }
}
