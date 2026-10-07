export async function readJsonWithCap(req: Request, maxBytes: number) {
  if (!req.body) return {};
  const reader = req.body.getReader();
  let receivedBytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        throw new Error("Payload too large");
      }
      chunks.push(value);
    }
  }
  const full = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    full.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(full));
}
