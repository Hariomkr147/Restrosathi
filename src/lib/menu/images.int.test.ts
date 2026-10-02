import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { processMenuPhoto } from "./images";

let directory: string;
const originalDir = process.env.UPLOAD_DIR;
beforeAll(async () => { directory = await mkdtemp(path.join(tmpdir(), "restrosathi-photo-test-")); process.env.UPLOAD_DIR = directory; });
afterAll(async () => {
  if (originalDir === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = originalDir;
  if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir())) throw new Error("Unsafe test cleanup path");
  await rm(directory, { recursive: true, force: true });
});
it("rejects files over 5 MB", async () => {
  await expect(processMenuPhoto(new File([new Uint8Array(6 * 1024 * 1024)], "large.png"))).rejects.toMatchObject({ code: "TOO_LARGE" });
});
it("rejects a text file named jpg", async () => {
  const content = await readFile(new URL("./__fixtures__/fake.jpg", import.meta.url));
  await expect(processMenuPhoto(new File([new Uint8Array(content)], "fake.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
});
it("rejects HEIC", async () => {
  await expect(processMenuPhoto(new File([new Uint8Array([0, 0, 0, 24]), "ftypheic"], "photo.heic"))).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
});
it("stores a WebP without EXIF, accepts content rather than extension", async () => {
  const png = await readFile(new URL("./__fixtures__/tiny.png", import.meta.url));
  const withExif = await sharp(png).withMetadata({ exif: { IFD0: { Copyright: "Test fixture" } } }).png().toBuffer();
  expect((await sharp(withExif).metadata()).exif).toBeDefined();
  const url = await processMenuPhoto(new File([new Uint8Array(withExif)], "not-an-extension.txt"));
  expect(url).toMatch(/^\/uploads\/menu\/[a-f0-9-]+\.webp$/);
  const meta = await sharp(await readFile(path.join(directory, url.replace("/uploads/", "")))).metadata();
  expect(meta.format).toBe("webp"); expect(meta.exif).toBeUndefined();
});
it("limits image width to 1200 pixels", async () => {
  const png = await sharp({ create: { width: 2400, height: 20, channels: 3, background: { r: 120, g: 90, b: 60 } } }).png().toBuffer();
  const url = await processMenuPhoto(new File([new Uint8Array(png)], "wide.png"));
  const meta = await sharp(await readFile(path.join(directory, url.replace("/uploads/", "")))).metadata();
  expect(meta.width).toBe(1200);
});
