import { afterAll, beforeEach, expect, it } from "vitest";
import { prisma } from "./db";
import { checkRate } from "./rate-limit";

const key = "rate-test:atomic";
beforeEach(async () => { await prisma.rateHit.deleteMany({ where: { key } }); });
afterAll(async () => { await prisma.rateHit.deleteMany({ where: { key } }); });
it("rejects the third hit at a limit of two", async () => {
  expect(await checkRate(key, 2, 3_600_000)).toBe(true);
  expect(await checkRate(key, 2, 3_600_000)).toBe(true);
  expect(await checkRate(key, 2, 3_600_000)).toBe(false);
  expect(await prisma.rateHit.count({ where: { key } })).toBe(2);
});
it("ignores and cleans expired hits", async () => {
  await prisma.rateHit.create({ data: { key, at: new Date(Date.now() - 10_000) } });
  expect(await checkRate(key, 1, 1_000)).toBe(true);
  expect(await prisma.rateHit.count({ where: { key } })).toBe(1);
});
it("parallel callers cannot exceed the cap, across three loops", async () => {
  for (let loop = 0; loop < 3; loop++) {
    await prisma.rateHit.deleteMany({ where: { key } });
    const results = await Promise.all(Array.from({ length: 10 }, () => checkRate(key, 2, 3_600_000)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await prisma.rateHit.count({ where: { key } })).toBe(2);
  }
});
