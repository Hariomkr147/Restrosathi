/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { describe, it, expect, vi } from "vitest";
import { runRetention } from "./retention";
import { S3Client } from "@aws-sdk/client-s3";

describe("Backup Retention", () => {
  it("selects exactly the >35 days old objects", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-07T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const day = 24 * 60 * 60 * 1000;
    
    const mockObjects = [
      { Key: "b1.enc", LastModified: new Date(now - 1 * day) },
      { Key: "b34.enc", LastModified: new Date(now - 34 * day) },
      { Key: "b35.enc", LastModified: new Date(now - 35 * day) },
      { Key: "b36.enc", LastModified: new Date(now - 36 * day - 1000) },
      { Key: "b90.enc", LastModified: new Date(now - 90 * day) }
    ];

    const deleted: string[] = [];
    const mockS3: any = {
      send: vi.fn().mockImplementation((cmd: any) => {
        if (cmd.constructor.name === "ListObjectsV2Command") {
          return Promise.resolve({ Contents: mockObjects });
        }
        if (cmd.constructor.name === "DeleteObjectsCommand") {
          cmd.input.Delete.Objects.forEach((o: any) => deleted.push(o.Key));
          return Promise.resolve({});
        }
      })
    };

    await runRetention(mockS3 as S3Client, "bucket", 35);
    expect(deleted).toEqual(["b36.enc", "b90.enc"]);
    vi.useRealTimers();
  });

  it("never deletes the newest object even if everything is old", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-07T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const day = 24 * 60 * 60 * 1000;
    
    const mockObjects = [
      { Key: "b36.enc", LastModified: new Date(now - 36 * day) },
      { Key: "b90.enc", LastModified: new Date(now - 90 * day) }
    ];

    const deleted: string[] = [];
    const mockS3: any = {
      send: vi.fn().mockImplementation((cmd: any) => {
        if (cmd.constructor.name === "ListObjectsV2Command") {
          return Promise.resolve({ Contents: mockObjects });
        }
        if (cmd.constructor.name === "DeleteObjectsCommand") {
          cmd.input.Delete.Objects.forEach((o: any) => deleted.push(o.Key));
          return Promise.resolve({});
        }
      })
    };

    await runRetention(mockS3 as S3Client, "bucket", 35);
    expect(deleted).toEqual(["b90.enc"]);
    vi.useRealTimers();
  });

  it("deletes nothing on listing error", async () => {
    const mockS3: any = {
      send: vi.fn().mockImplementation((cmd: any) => {
        if (cmd.constructor.name === "ListObjectsV2Command") {
          return Promise.reject(new Error("List failed"));
        }
        if (cmd.constructor.name === "DeleteObjectsCommand") {
          return Promise.resolve({});
        }
      })
    };

    await expect(runRetention(mockS3 as S3Client, "bucket", 35)).rejects.toThrow("List failed");
    
    const calls = mockS3.send.mock.calls;
    expect(calls.some((c: any) => c[0].constructor.name === "DeleteObjectsCommand")).toBe(false);
  });
});
