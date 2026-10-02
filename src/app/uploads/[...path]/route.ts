import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  if (!Array.isArray(segments) || segments.length !== 2 || segments[0] !== "menu" || !/^[a-f0-9-]{36}\.webp$/.test(segments[1])) return new Response(null, { status: 404 });
  // Uploaded files are runtime data, supplied by UPLOAD_DIR rather than the build.
  const root = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "./uploads");
  try {
    const file = await realpath(path.join(/* turbopackIgnore: true */ root, ...segments));
    const actualRoot = await realpath(/* turbopackIgnore: true */ root);
    if (!file.startsWith(actualRoot + path.sep)) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(await readFile(file)), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    throw error;
  }
}
