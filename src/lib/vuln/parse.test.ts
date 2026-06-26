import { describe, expect, it } from "vitest";
import { parseCsv, parseNessus, parseScan } from "./parse";

describe("parseCsv", () => {
  it("maps Nessus-style CSV columns and handles quoted commas", () => {
    const csv = [
      `Plugin ID,CVE,Risk,Name,Host,CVSS,Solution`,
      `19506,CVE-2021-1234,High,"OpenSSL outdated, upgrade",10.0.0.5,7.5,"Update to 3.0"`,
      `11111,,Medium,Weak ciphers,10.0.0.6,5.0,Disable weak ciphers`,
    ].join("\n");
    const out = parseCsv(csv);
    expect(out).toHaveLength(2);
    expect(out[0].pluginId).toBe("19506");
    expect(out[0].cve).toBe("CVE-2021-1234");
    expect(out[0].title).toBe("OpenSSL outdated, upgrade");
    expect(out[0].host).toBe("10.0.0.5");
    expect(out[0].cvss).toBe(7.5);
    expect(out[0].severity).toBe("High");
  });

  it("throws when no title-like column exists", () => {
    expect(() => parseCsv("foo,bar\n1,2")).toThrow();
  });
});

describe("parseNessus", () => {
  it("extracts ReportItems with host, severity, cvss, and cve", () => {
    const xml = `<?xml version="1.0"?>
    <NessusClientData_v2><Report name="scan"><ReportHost name="10.0.0.5">
      <ReportItem port="443" severity="4" pluginID="19506" pluginName="TLS 1.0 supported">
        <description>Legacy TLS</description>
        <solution>Disable TLS 1.0</solution>
        <cvss3_base_score>9.1</cvss3_base_score>
        <cve>CVE-2020-0001</cve>
      </ReportItem>
      <ReportItem port="0" severity="0" pluginID="19999" pluginName="Info item"/>
    </ReportHost></Report></NessusClientData_v2>`;
    const out = parseNessus(xml);
    expect(out).toHaveLength(2);
    expect(out[0].host).toBe("10.0.0.5");
    expect(out[0].pluginId).toBe("19506");
    expect(out[0].severity).toBe("4");
    expect(out[0].cvss).toBe(9.1);
    expect(out[0].cve).toBe("CVE-2020-0001");
    expect(out[0].port).toBe("443");
  });

  it("rejects non-nessus XML", () => {
    expect(() => parseNessus("<foo></foo>")).toThrow();
  });
});

describe("parseScan dispatch", () => {
  it("routes .csv to CSV and xml content to Nessus", () => {
    expect(parseScan("a.csv", "Name,Host\nx,1").source).toBe("CSV");
    expect(
      parseScan("a.nessus", `<NessusClientData_v2><Report><ReportHost name="h"></ReportHost></Report></NessusClientData_v2>`)
        .source
    ).toBe("Nessus");
  });
});
