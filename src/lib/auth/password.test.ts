import { expect, it } from "vitest";
import { hashSecret, verifySecret } from "./password";

it("verifies the right secret", async () => expect(await verifySecret("s3cret!", await hashSecret("s3cret!"))).toBe(true));
it("rejects the wrong secret", async () => expect(await verifySecret("nope", await hashSecret("s3cret!"))).toBe(false));
it("salts hashes", async () => expect(await hashSecret("x")).not.toBe(await hashSecret("x")));
it("rejects malformed stored hashes", async () => {
  for (const stored of ["", "scrypt$invalid$invalid", "scrypt$a$b$extra", "sha256$a$b"]) {
    expect(await verifySecret("s3cret!", stored)).toBe(false);
  }
});
