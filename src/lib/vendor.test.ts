import { describe, it, expect } from "vitest";
import { vendorRiskRating, computeNextReviewDate, isReviewOverdue, formatVendorNumber } from "./vendor";

describe("vendorRiskRating", () => {
  it("rates high-sensitivity + critical vendors CRITICAL", () => {
    expect(vendorRiskRating("CUI", "CRITICAL")).toBe("CRITICAL");
    expect(vendorRiskRating("PHI", "CRITICAL")).toBe("CRITICAL");
  });
  it("rates low-sensitivity vendors LOW", () => {
    expect(vendorRiskRating("NONE", "LOW")).toBe("LOW");
    expect(vendorRiskRating("PUBLIC", "LOW")).toBe("LOW");
  });
  it("scales with both axes", () => {
    expect(vendorRiskRating("PII", "HIGH")).toBe("HIGH");
    expect(vendorRiskRating("INTERNAL", "MODERATE")).toBe("MEDIUM");
  });
});

describe("computeNextReviewDate", () => {
  it("returns null for NONE cadence", () => {
    expect(computeNextReviewDate(new Date(), "NONE")).toBeNull();
  });
  it("adds cadence days", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    expect(computeNextReviewDate(base, "ANNUAL")?.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(computeNextReviewDate(base, "QUARTERLY")?.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
});

describe("isReviewOverdue", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  it("is overdue when the date is in the past", () => {
    expect(isReviewOverdue(new Date(now.getTime() - 86_400_000), now)).toBe(true);
    expect(isReviewOverdue(new Date(now.getTime() + 86_400_000), now)).toBe(false);
    expect(isReviewOverdue(null, now)).toBe(false);
  });
});

describe("formatVendorNumber", () => {
  it("zero-pads to four digits", () => {
    expect(formatVendorNumber(1)).toBe("VEND-0001");
    expect(formatVendorNumber(42)).toBe("VEND-0042");
  });
});
