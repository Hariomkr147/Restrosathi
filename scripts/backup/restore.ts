import { parseArgs } from "util";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { getS3Client, getBucketName } from "./s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { DecryptStream } from "./crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

async function execCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const proc = spawn(command, args);
    proc.stdout.on("data", (d) => stdout += d.toString());
    proc.stderr.on("data", (d) => stderr += d.toString());
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Command ${command} failed: ${stderr}`));
    });
    proc.on("error", reject);
  });
}

export async function runRestore() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "target-db": { type: "string" },
      "files-dir": { type: "string" },
      "confirm": { type: "boolean" },
      "i-know-this-overwrites": { type: "boolean" }
    },
    allowPositionals: true
  });

  const objectKey = positionals[0];
  if (!objectKey) {
    console.error("Usage: restore.ts <objectKey> --target-db <url> --files-dir <dir> --confirm");
    process.exit(1);
  }

  if (!values.confirm) {
    console.error("Must pass --confirm");
    process.exit(1);
  }

  const targetDb = values["target-db"];
  if (!targetDb) {
    console.error("Must pass --target-db <url>");
    process.exit(1);
  }

  const filesDir = values["files-dir"];
  if (!filesDir) {
    console.error("Must pass --files-dir <dir>");
    process.exit(1);
  }

  if (targetDb === process.env.DATABASE_URL && !values["i-know-this-overwrites"]) {
    console.error("Target DB matches DATABASE_URL. Must pass --i-know-this-overwrites to proceed.");
    process.exit(1);
  }

  const s3 = getS3Client();
  const bucket = getBucketName();
  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("Missing BACKUP_ENCRYPTION_KEY");

  // Fetch hash
  const hashObj = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey.replace(".enc", ".sha256")
  }));
  const expectedHash = await hashObj.Body?.transformToString();
  if (!expectedHash) throw new Error("Could not read hash from S3");

  const tmpDir = await fs.mkdtemp("restrosathi-restore-");
  console.log(`Working in ${tmpDir}`);

  try {
    const encFile = path.join(tmpDir, "encrypted.tar.gz.enc");
    
    // Download and hash
    const dataObj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    if (!dataObj.Body) throw new Error("Could not read data from S3");

    console.log("Downloading...");
    const hash = crypto.createHash("sha256");
    const writeStream = (await import("fs")).createWriteStream(encFile);

    const bodyStream = dataObj.Body as Readable;
    bodyStream.on("data", (chunk) => hash.update(chunk));
    
    await pipeline(bodyStream, writeStream);

    const actualHash = hash.digest("hex");
    if (actualHash !== expectedHash) {
      throw new Error(`Hash mismatch. Expected ${expectedHash}, got ${actualHash}`);
    }
    console.log("Hash verified.");

    console.log("Decrypting and extracting...");
    const readStream = (await import("fs")).createReadStream(encFile);
    const decryptStream = new DecryptStream(encryptionKey);
    
    const tarProc = spawn("tar", ["-xz", "-C", tmpDir], { stdio: ["pipe", "inherit", "inherit"] });
    
    const tarPromise = new Promise<void>((resolve, reject) => {
      tarProc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar exited with code ${code}`));
      });
      tarProc.on("error", reject);
    });

    await Promise.all([
      pipeline(readStream, decryptStream, tarProc.stdin),
      tarPromise
    ]);

    console.log("Decrypted and extracted.");

    // Find db.dump inside tmpDir
    let dbDumpPath = "";
    async function findDump(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await findDump(full);
        } else if (entry.name === "db.dump") {
          dbDumpPath = full;
        }
      }
    }
    await findDump(tmpDir);

    if (!dbDumpPath) throw new Error("Could not find db.dump in archive");

    console.log("Restoring DB...");
    // -O ignores ownership
    // -x ignores privileges
    // --clean drops before create
    // we use a spawn instead of exec to handle stderr
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("pg_restore", ["-d", targetDb, "--clean", "-O", "-x", dbDumpPath], { stdio: "ignore" });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_restore failed with code ${code}`));
      });
      proc.on("error", reject);
    });

    // Output row counts
    const countsCmd = `
      SELECT 'User' as table, count(*) FROM "User"
      UNION ALL SELECT 'Settings', count(*) FROM "Settings"
      UNION ALL SELECT 'MenuItem', count(*) FROM "MenuItem"
      UNION ALL SELECT 'Bill', count(*) FROM "Bill"
      UNION ALL SELECT 'Booking', count(*) FROM "Booking";
    `;
    const result = await execCommand("psql", [targetDb, "-t", "-c", countsCmd]);
    console.log("Row counts:");
    console.log(result.trim());

    console.log("Restore complete.");
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

if (require.main === module) {
  runRestore().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
