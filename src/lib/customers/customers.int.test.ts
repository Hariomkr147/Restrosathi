import { describe, test, expect, beforeAll, afterEach } from "vitest";
import { prisma } from "../../lib/db";
import { upsertCustomer } from "./index";

beforeAll(async () => {
  await prisma.customer.deleteMany();
});

afterEach(async () => {
  await prisma.customer.deleteMany();
});

describe("customers", () => {
  test("upsertCustomer normalises phone and de-duplicates", async () => {
    const c1 = await upsertCustomer("98765 43210", { name: "Alice" });
    expect(c1.phone).toBe("+919876543210");
    expect(c1.name).toBe("Alice");
    
    // Upsert with exact same normalised phone
    const c2 = await upsertCustomer("+919876543210", { name: "Alice Smith" });
    expect(c2.id).toBe(c1.id);
    expect(c2.name).toBe("Alice Smith"); // updates name
    
    const count = await prisma.customer.count();
    expect(count).toBe(1);
  });
});
