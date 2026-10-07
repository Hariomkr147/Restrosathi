/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runBackup } from "./run";
import { runRestore } from "./restore";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { S3Client, CreateBucketCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";

describe("Backup Integration", () => {
  let s3: S3Client;
  let tmpUploads = "";
  let tmpRestore = "";
  const scratchDbUrl = "postgresql://restrosathi:restrosathi@127.0.0.1:15432/restrosathi_restore_test?schema=public";
  
  let hasPgDump = true;
  try {
    execSync("pg_dump --version", { stdio: "ignore" });
  } catch {
    hasPgDump = false;
  }
  
  beforeAll(async () => {
    if (!hasPgDump) throw new Error("pg_dump is required to run backup tests");

    try {
      execSync("docker-compose -f docker-compose.floci.yml up -d floci", { stdio: "ignore" });
    } catch (e) {
      throw new Error("Could not start floci via docker-compose. Docker is required to run backup tests.");
    }

    process.env.S3_ENDPOINT = "http://127.0.0.1:4566";
    process.env.S3_BUCKET = "restrosathi-test-backups";
    process.env.S3_ACCESS_KEY_ID = "test";
    process.env.S3_SECRET_ACCESS_KEY = "test";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_FORCE_PATH_STYLE = "true";
    process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, "a").toString("base64");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; // backup from test db
    
    tmpUploads = await fs.mkdtemp("restrosathi-test-uploads-");
    tmpRestore = await fs.mkdtemp("restrosathi-test-restore-");
    process.env.BACKUP_PATHS = tmpUploads;
    
    await fs.writeFile(path.join(tmpUploads, "hello.txt"), "hello world");

    s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!
      },
      forcePathStyle: true
    });

    try {
      await s3.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
    } catch (e: any) {
      if (e.name !== "BucketAlreadyOwnedByYou" && e.name !== "BucketAlreadyExists") {
        throw e;
      }
    }

    // Drop and recreate scratch DB
    try {
      execSync(`psql "${process.env.DATABASE_URL?.replace("restrosathi_test", "postgres")}" -c "DROP DATABASE IF EXISTS restrosathi_restore_test"`);
      execSync(`psql "${process.env.DATABASE_URL?.replace("restrosathi_test", "postgres")}" -c "CREATE DATABASE restrosathi_restore_test"`);
    } catch (e) {
      console.warn("Scratch DB setup failed", e);
    }
  }, 60000);

  afterAll(async () => {
    try {
      await fs.rm(tmpUploads, { recursive: true, force: true });
      await fs.rm(tmpRestore, { recursive: true, force: true });
    } catch {}
  });

  it("runs a full backup and restore drill", async () => {
    const prisma = new PrismaClient();
    
    // Seed something
    await prisma.settings.upsert({
      where: { id: 1 },
      create: {
        name: "Test Restore",
        taxMode: "REGULAR",
        gstRatePercent: 5,
        pricesIncludeTax: false,
        about: {},
        hours: {},
        address: "123 Test St",
        phone: "+919876543210",
        whatsappPhone: "+919876543210"
      },
      update: { name: "Test Restore" }
    });

    await prisma.user.create({
      data: {
        name: "Restorer",
        role: "OWNER",
        passwordHash: "x",
        pinHash: "x"
      }
    });

    // 1. Run backup
    await runBackup();

    // Check BackupRun row
    const run = await prisma.backupRun.findFirst({ orderBy: { at: "desc" } });
    expect(run).toBeDefined();
    expect(run?.ok).toBe(true);
    expect(run?.objectKey).toContain(".tar.gz.enc");

    const objectKey = run!.objectKey!;

    // Check S3
    await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: objectKey }));
    await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: objectKey.replace(".enc", ".sha256") }));

    // 2. Run Restore
    // Mock process.argv and process.exit for runRestore
    const originalArgv = process.argv;
    const originalExit = process.exit;
    let exitCode = 0;
    
    try {
      process.argv = ["node", "restore.ts", objectKey, "--target-db", scratchDbUrl, "--files-dir", tmpRestore, "--confirm"];
      // @ts-ignore
      process.exit = (code: number) => { exitCode = code; throw new Error("EXIT"); };
      
      await runRestore();
    } catch (e: any) {
      if (e.message !== "EXIT") throw e;
    } finally {
      process.argv = originalArgv;
      process.exit = originalExit;
    }

    expect(exitCode).toBe(0);

    // Verify scratch DB has the rows
    const countStdout = execSync(`psql "${scratchDbUrl}" -t -c "SELECT count(*) FROM \\"Settings\\";"`).toString();
    expect(parseInt(countStdout.trim())).toBeGreaterThan(0);
    
    const usersCount = execSync(`psql "${scratchDbUrl}" -t -c "SELECT count(*) FROM \\"User\\";"`).toString();
    expect(parseInt(usersCount.trim())).toBeGreaterThan(0);

    // Verify files dir has hello.txt (it might be under the nested path structure of tmpUploads)
    // The tar will have created the path from the root.
    // Actually, `tar -xz -C tmpRestore` will restore the exact absolute path inside tmpRestore if it was absolute, 
    // or relative. We can just check if hello.txt exists somewhere inside tmpRestore.
    const findHello = execSync(`find ${tmpRestore} -name "hello.txt"`).toString();
    expect(findHello).toContain("hello.txt");
  }, 60000);
});
