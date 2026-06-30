import { describe, it, expect } from "vitest";
import { similarity, bestMatches, tokenize } from "./match";

describe("tokenize", () => {
  it("lowercases, strips punctuation, and drops stopwords", () => {
    expect(tokenize("Do you enforce MFA?")).toEqual(["enforce", "mfa"]);
  });
});

describe("similarity", () => {
  it("is 1 for identical questions", () => {
    expect(similarity("encryption at rest", "encryption at rest")).toBeCloseTo(1, 5);
  });
  it("is high for paraphrases sharing key terms", () => {
    expect(similarity("Do you encrypt data at rest?", "Is data encrypted at rest?")).toBeGreaterThan(0.4);
  });
  it("is 0 for disjoint questions", () => {
    expect(similarity("encryption keys", "office parking policy")).toBe(0);
  });
});

describe("bestMatches", () => {
  const library = [
    { id: "1", question: "Do you enforce multi-factor authentication?", answer: "Yes, MFA.", sourceRefs: "[]" },
    { id: "2", question: "Is data encrypted at rest?", answer: "Yes, AES-256.", sourceRefs: "[]" },
    { id: "3", question: "Do you have an incident response plan?", answer: "Yes.", sourceRefs: "[]" },
  ];
  it("ranks the closest library entry first", () => {
    const m = bestMatches("Is information encrypted at rest?", library);
    expect(m[0].candidate.id).toBe("2");
  });
  it("returns nothing below the floor", () => {
    expect(bestMatches("unrelated parking question", library, 3, 0.2)).toEqual([]);
  });
});
