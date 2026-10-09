import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createStaff, resetStaffPin, setStaffActive, changeOwnerPassword } from "./accounts";
import { prisma } from "../db";
import { verifySecret } from "./password";
import { asOwner, asAnonymous } from "../../../tests/helpers/auth";
import { loginWithPin } from "../../app/login/actions";
import { isLockedOut, recordFailure } from "./rate-limit";

describe("Accounts Integration", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { role: "STAFF" } });
    await prisma.loginAttempt.deleteMany();
    await prisma.authSession.deleteMany();
    await asOwner(); // mock session to owner
  });

  afterEach(async () => {
    await asAnonymous();
  });
  
  it("creates staff and enforces concurrent active-name uniqueness", async () => {
    const p1 = createStaff({ name: "Ravi", pin: "1234" });
    const p2 = createStaff({ name: "Ravi", pin: "5678" });
    
    const results = await Promise.allSettled([p1, p2]);
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const errorCount = results.filter(r => r.status === "rejected").length;
    
    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);
    
    // Check we can login with the one that succeeded
    const staff = await prisma.user.findFirst({ where: { name: "Ravi" } });
    expect(staff).toBeDefined();
    
    // Try login
    await asAnonymous();
    const loginRes = await loginWithPin({ userId: staff!.id, pin: "1234" });
    // Assuming the one that succeeded is either 1234 or 5678.
    // In our test, if it fails, it returns { error: 'invalid' }
    // If it succeeds, it redirects.
    if (loginRes && "error" in loginRes) {
      expect((loginRes as any).error).toBe("invalid");
      const altLogin = await loginWithPin({ userId: staff!.id, pin: "5678" });
      expect((altLogin as any)?.error).toBeUndefined(); // means redirect threw
    } else {
      expect((loginRes as any)?.error).toBeUndefined();
    }
  });

  it("reset invalidates old PIN and existing lockout remains", async () => {
    const staff = await createStaff({ name: "OldPin", pin: "1111" });
    
    // simulate lockout
    for (let i = 0; i < 5; i++) {
      await recordFailure([`user:${staff.id}`]);
    }
    expect(await isLockedOut([`user:${staff.id}`])).toBe(true);

    // reset PIN
    await resetStaffPin(staff.id, "2222");

    // lockout should remain
    expect(await isLockedOut([`user:${staff.id}`])).toBe(true);

    // Old PIN shouldn't verify
    const updatedStaff = await prisma.user.findUnique({ where: { id: staff.id } });
    const oldValid = await verifySecret("1111", updatedStaff!.pinHash!);
    const newValid = await verifySecret("2222", updatedStaff!.pinHash!);
    expect(oldValid).toBe(false);
    expect(newValid).toBe(true);
  });
});
