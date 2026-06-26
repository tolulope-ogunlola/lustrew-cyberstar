import { describe, expect, it } from "vitest";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "./rateLimit";

describe("login rate limiting", () => {
  it("blocks after 5 failures and clears on success", () => {
    const key = `test-${Math.random()}`;
    expect(isLoginBlocked(key)).toBe(false);
    for (let i = 0; i < 5; i++) recordLoginFailure(key);
    expect(isLoginBlocked(key)).toBe(true);
    clearLoginFailures(key);
    expect(isLoginBlocked(key)).toBe(false);
  });

  it("keeps distinct keys independent", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) recordLoginFailure(a);
    expect(isLoginBlocked(a)).toBe(true);
    expect(isLoginBlocked(b)).toBe(false);
  });
});
