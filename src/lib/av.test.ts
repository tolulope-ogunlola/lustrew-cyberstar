import { describe, expect, it } from "vitest";
import { contentMatchesType, scanBuffer } from "./av";

describe("malware scan", () => {
  it("rejects the EICAR test signature", async () => {
    const buf = Buffer.from("prefix EICAR-STANDARD-ANTIVIRUS-TEST-FILE suffix");
    expect((await scanBuffer(buf)).clean).toBe(false);
  });
  it("passes clean content", async () => {
    expect((await scanBuffer(Buffer.from("a normal document"))).clean).toBe(true);
  });
});

describe("content-type sniffing", () => {
  it("accepts a real PDF and rejects a fake one", () => {
    expect(contentMatchesType(Buffer.from("%PDF-1.7\n..."), "application/pdf")).toBe(true);
    expect(contentMatchesType(Buffer.from("not a pdf"), "application/pdf")).toBe(false);
  });
  it("accepts a PNG by magic bytes", () => {
    expect(contentMatchesType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]), "image/png")).toBe(true);
  });
  it("accepts ZIP-based Office docs", () => {
    expect(
      contentMatchesType(
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
  });
  it("allows unsniffable text types", () => {
    expect(contentMatchesType(Buffer.from("a,b,c"), "text/csv")).toBe(true);
    expect(contentMatchesType(Buffer.from("{}"), "application/json")).toBe(true);
  });
});
