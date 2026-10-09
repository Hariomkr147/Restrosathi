/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Transform } from "stream";
import crypto from "crypto";

const MAGIC_V1 = Buffer.from("RS_BACKUP\x01");
const MAGIC_V2 = Buffer.from("RS_BACKUP\x02");
const CHUNK_SIZE = 1024 * 1024; // 1 MiB

export class EncryptStream extends Transform {
  private key: Buffer;
  private buffer: Buffer = Buffer.alloc(0);
  private headerWritten = false;
  private fileId = crypto.randomBytes(32);
  private chunkIndex = 0;

  constructor(keyBase64: string) {
    super();
    this.key = Buffer.from(keyBase64, "base64");
    if (this.key.length !== 32) throw new Error("Key must be exactly 32 bytes");
  }

  _transform(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    
    if (!this.headerWritten) {
      this.push(Buffer.concat([MAGIC_V2, this.fileId]));
      this.headerWritten = true;
    }

    while (this.buffer.length >= CHUNK_SIZE) {
      const chunkToEncrypt = this.buffer.subarray(0, CHUNK_SIZE);
      this.buffer = this.buffer.subarray(CHUNK_SIZE);
      this._encryptChunk(chunkToEncrypt, false);
    }
    
    callback();
  }

  _flush(callback: (error?: Error | null) => void) {
    if (!this.headerWritten) {
      this.push(Buffer.concat([MAGIC_V2, this.fileId]));
      this.headerWritten = true;
    }
    if (this.buffer.length > 0) {
      this._encryptChunk(this.buffer, false);
    }
    
    // Write an end marker: length 0 and isFinal true
    this._encryptChunk(Buffer.alloc(0), true);
    callback();
  }

  private _encryptChunk(data: Buffer, isFinal: boolean) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    
    const aad = Buffer.alloc(32 + 4 + 4 + 1);
    this.fileId.copy(aad, 0);
    aad.writeUInt32BE(this.chunkIndex, 32);
    aad.writeUInt32BE(data.length, 36);
    aad.writeUInt8(isFinal ? 1 : 0, 40);
    cipher.setAAD(aad);

    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    
    this.push(Buffer.concat([lenBuf, iv, ciphertext, tag]));
    this.chunkIndex++;
  }
}

export class DecryptStream extends Transform {
  private key: Buffer;
  private buffer: Buffer = Buffer.alloc(0);
  private headerRead = false;
  private isDone = false;
  private version: number = 0;
  private fileId: Buffer | null = null;
  private chunkIndex = 0;

  constructor(keyBase64: string) {
    super();
    this.key = Buffer.from(keyBase64, "base64");
    if (this.key.length !== 32) throw new Error("Key must be exactly 32 bytes");
  }

  _transform(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
    if (this.isDone) return callback(new Error("Data appended after end marker"));
    
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (!this.headerRead) {
      if (this.buffer.length < 10) return callback(); // wait for magic
      const magic = this.buffer.subarray(0, 10);
      if (magic.equals(MAGIC_V1)) {
        this.version = 1;
        console.warn("WARNING: Decrypting legacy V1 backup. Integrity is not fully authenticated.");
        this.buffer = this.buffer.subarray(10);
        this.headerRead = true;
      } else if (magic.equals(MAGIC_V2)) {
        this.version = 2;
        if (this.buffer.length < 10 + 32) return callback(); // wait for fileId
        this.fileId = this.buffer.subarray(10, 10 + 32);
        this.buffer = this.buffer.subarray(10 + 32);
        this.headerRead = true;
      } else {
        return callback(new Error("Invalid magic header"));
      }
    }

    try {
      while (true) {
        if (this.buffer.length < 4) break;
        const len = this.buffer.readUInt32BE(0);
        
        if (this.version === 1) {
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
        } else if (this.version === 2) {
          const chunkTotalLen = 4 + 12 + len + 16;
          if (this.buffer.length < chunkTotalLen) break;

          const iv = this.buffer.subarray(4, 4 + 12);
          const ciphertext = this.buffer.subarray(4 + 12, 4 + 12 + len);
          const tag = this.buffer.subarray(4 + 12 + len, chunkTotalLen);

          const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, iv);
          
          const isFinal = len === 0;
          const aad = Buffer.alloc(32 + 4 + 4 + 1);
          this.fileId!.copy(aad, 0);
          aad.writeUInt32BE(this.chunkIndex, 32);
          aad.writeUInt32BE(len, 36);
          aad.writeUInt8(isFinal ? 1 : 0, 40);
          decipher.setAAD(aad);
          decipher.setAuthTag(tag);
          
          const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
          
          if (len > 0) {
            this.push(decrypted);
          }
          
          this.buffer = this.buffer.subarray(chunkTotalLen);
          this.chunkIndex++;
          
          if (isFinal) {
            this.isDone = true;
            break;
          }
        }
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
