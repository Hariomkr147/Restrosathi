import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export class UploadError extends Error {
  constructor(public code: "TOO_LARGE" | "UNSUPPORTED_TYPE") { super(code); this.name = "UploadError"; }
}
export async function processMenuPhoto(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new UploadError("TOO_LARGE");
  const buffer = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const image = sharp(buffer, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new UploadError("UNSUPPORTED_TYPE");
    output = await image.rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("UNSUPPORTED_TYPE");
  }
  const name = `${randomUUID()}.webp`;
  const directory = path.resolve(process.env.UPLOAD_DIR ?? "./uploads", "menu");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), output, { flag: "wx" });
  return `/uploads/menu/${name}`;
}
