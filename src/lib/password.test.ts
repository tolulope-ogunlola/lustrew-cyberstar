import { describe, expect, it } from "vitest";
import { passwordSchema } from "./validation";
import { generateTempPassword, hashPassword, verifyPassword } from "./password";

describe("password policy", () => {
  it("rejects short or weak passwords", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("alllettersonly").success).toBe(false); // no digit
    expect(passwordSchema.safeParse("1234567890").success).toBe(false); // no letter
  });

  it("accepts a compliant password", () => {
    expect(passwordSchema.safeParse("Compliant123").success).toBe(true);
  });

  it("generated temp passwords satisfy the policy", () => {
    for (let i = 0; i < 20; i++) {
      expect(passwordSchema.safeParse(generateTempPassword()).success).toBe(true);
    }
  });
});

describe("password hashing", () => {
  it("round-trips a hash", async () => {
    const hash = await hashPassword("Compliant123");
    expect(await verifyPassword("Compliant123", hash)).toBe(true);
    expect(await verifyPassword("WrongPass123", hash)).toBe(false);
  });
});
