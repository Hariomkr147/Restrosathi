import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => {
  return {
    prisma: {
      $queryRawUnsafe: vi.fn()
    }
  };
});

describe("Health Check API", () => {
  it("returns 200 and ok: true on DB success", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([{ "?column?": 1 }]);
    const req = new Request("http://localhost:3000/api/health");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.time).toBeDefined();
  });

  it("returns 503 and ok: false on DB failure", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockRejectedValueOnce(new Error("DB Down"));
    const req = new Request("http://localhost:3000/api/health");
    const res = await GET(req);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.time).toBeUndefined();
  });
});
