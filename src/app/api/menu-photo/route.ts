import { AuthError, requireUser } from "@/lib/auth/session";
import { uploadMenuPhoto } from "@/lib/menu/mutations";
import { UploadError } from "@/lib/menu/images";

export async function POST(request: Request) {
  try {
    await requireUser("OWNER");
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    const reader = request.body?.getReader();
    if (!reader) throw new UploadError("UNSUPPORTED_TYPE");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5 * 1024 * 1024 + 64 * 1024) { await reader.cancel(); throw new UploadError("TOO_LARGE"); }
      chunks.push(value);
    }
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    return Response.json({ ok: true, url: await uploadMenuPhoto(form) });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    if (error instanceof UploadError) return Response.json({ ok: false, error: error.code }, { status: error.code === "TOO_LARGE" ? 413 : 415 });
    return Response.json({ ok: false, error: "UPLOAD_FAILED" }, { status: 400 });
  }
}
