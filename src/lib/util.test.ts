import { describe, expect, it } from "vitest";
import { parseFrameworks, serializeFrameworks, withFrameworks } from "./util";

describe("frameworks serialization", () => {
  it("round-trips an array", () => {
    const arr = ["NIST_RMF", "NIST_800_53"];
    expect(parseFrameworks(serializeFrameworks(arr))).toEqual(arr);
  });

  it("returns [] for invalid JSON", () => {
    expect(parseFrameworks("not-json")).toEqual([]);
  });

  it("returns [] for non-array JSON", () => {
    expect(parseFrameworks('{"a":1}')).toEqual([]);
  });

  it("withFrameworks reshapes the row to an array field", () => {
    const row = { id: "1", frameworks: serializeFrameworks(["FISMA"]) };
    const out = withFrameworks(row);
    expect(out.frameworks).toEqual(["FISMA"]);
    expect(out.id).toBe("1");
  });
});
