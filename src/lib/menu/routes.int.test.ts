import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { asAnonymous, asOwner, asStaff } from "../../../tests/helpers/auth";
import { POST } from "../../app/api/menu-photo/route";
import { GET } from "../../app/uploads/[...path]/route";

let directory: string;
const original = process.env.UPLOAD_DIR;
const url = "http://localhost:3000/api/menu-photo";
beforeAll(async () => { directory = await mkdtemp(path.join(tmpdir(), "restrosathi-route-test-")); process.env.UPLOAD_DIR = directory; });
afterAll(async () => {
  if (original === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = original;
  if (path.dirname(path.resolve(directory)) !== path.resolve(tmpdir())) throw new Error("Unsafe test cleanup path");
  await rm(directory, { recursive: true, force: true });
});
it("upload route rejects anonymous and wrong-role users", async () => {
  for (const session of [asAnonymous, asStaff]) { await session(); expect((await POST(new Request(url, { method: "POST" }))).status).toBe(403); }
});
it("upload route rejects cross-origin requests before parsing", async () => {
  await asOwner();
  expect((await POST(new Request(url, { method: "POST", headers: { origin: "https://foreign.example" } }))).status).toBe(403);
});
it("upload route bounds chunked bodies without relying on content-length", async () => {
  await asOwner();
  const response = await POST(new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" }, body: new Uint8Array(6 * 1024 * 1024) }));
  expect(response.status).toBe(413); expect(await response.json()).toMatchObject({ error: "TOO_LARGE" });
});
it("owner upload is served publicly as immutable WebP", async () => {
  await asOwner();
  const form = new FormData(); form.set("photo", new File([new Uint8Array(await readFile(new URL("./__fixtures__/tiny.png", import.meta.url)))], "photo.png"));
  const response = await POST(new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" }, body: form }));
  expect(response.status).toBe(200);
  const result = await response.json(); expect(result.ok).toBe(true);
  asAnonymous();
  const file = await GET(new Request(url), { params: Promise.resolve({ path: result.url.replace("/uploads/", "").split("/") }) });
  expect(file.status).toBe(200); expect(file.headers.get("content-type")).toBe("image/webp");
  expect(file.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect((await file.arrayBuffer()).byteLength).toBeGreaterThan(0);
});
it("file serving rejects traversal and unexpected files", async () => {
  for (const segments of [["..", "secret"], ["menu", "..", "secret"], ["menu", "photo.svg"], ["menu", "..\\secret.webp"]]) {
    expect((await GET(new Request(url), { params: Promise.resolve({ path: segments }) })).status).toBe(404);
  }
});
