/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { EncryptStream } from "./crypto";
import { getS3Client, getBucketName } from "./s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PrismaClient } from "@prisma/client";
import { runRetention } from "./retention";

const prisma = new PrismaClient();

async function execCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: "ignore" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command ${command} exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

export async function runBackup() {
  const tmpDir = await fs.mkdtemp("restrosathi-backup-");
  const dbDumpPath = path.join(tmpDir, "db.dump");
  let ok = false;
  let bytes: number | undefined;
  let objectKey: string | undefined;
  let errorMsg: string | undefined;

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("Missing DATABASE_URL");

    // 1. pg_dump
    await execCommand("pg_dump", [dbUrl, "-Fc", "-f", dbDumpPath]);

    // 2. Collect paths for tar
    const backupPathsStr = process.env.BACKUP_PATHS || "";
    const pathsToTar = [dbDumpPath];
    for (const p of backupPathsStr.split(",")) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      try {
        await fs.access(trimmed);
        pathsToTar.push(trimmed);
      } catch {
        console.warn(`Backup path not found, skipping: ${trimmed}`);
      }
    }

    // 3. Tar + Gzip + Encrypt + Hash -> S3
    const s3 = getS3Client();
    const bucket = getBucketName();
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error("Missing BACKUP_ENCRYPTION_KEY");

    const tarProc = spawn("tar", ["-cz", ...pathsToTar], { stdio: ["ignore", "pipe", "inherit"] });
    
    const encryptStream = new EncryptStream(encryptionKey);
    const hash = crypto.createHash("sha256");

    tarProc.stdout.pipe(encryptStream);
    encryptStream.on("data", (chunk) => hash.update(chunk));

    const now = new Date();
    const prefix = `restrosathi/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    objectKey = `${prefix}/restrosathi-${now.toISOString().replace(/[:.]/g, "-")}.tar.gz.enc`;

    const upload = new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: objectKey,
        Body: encryptStream
      }
    });

    await upload.done();

    // 4. Upload the hash
    const hashHex = hash.digest("hex");
    const hashUpload = new Upload({
      client: s3,
      params: {
        Bucket: bucket,
        Key: objectKey.replace(".enc", ".sha256"),
        Body: hashHex
      }
    });
    await hashUpload.done();

    // Verify tar exited successfully
    await new Promise<void>((resolve, reject) => {
      tarProc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar exited with code ${code}`));
      });
      tarProc.on("error", reject);
      encryptStream.on("error", reject);
    });

    // 5. Retention
    const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || "35", 10);
    await runRetention(s3, bucket, retentionDays);

    ok = true;
  } catch (err: any) {
    console.error("Backup failed:", err);
    ok = false;
    errorMsg = String(err.message || err).substring(0, 300);
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}

    await prisma.backupRun.create({
      data: {
        ok,
        error: errorMsg,
        objectKey
      }
    });

    if (!ok) {
      process.exitCode = 1;
    }
  }
}

// ESM-compatible entry detection for TSX/Node
const isMain = typeof require !== 'undefined' 
  ? require.main === module 
  : process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() || '');

if (isMain || process.argv[1]?.endsWith("run.ts")) {
  runBackup().then(() => {
    console.log("Backup complete.");
    process.exit(process.exitCode || 0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
