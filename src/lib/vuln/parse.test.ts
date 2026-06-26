import { describe, expect, it } from "vitest";
import { parseCsv, parseNessus, parseScan, detectCsvSource } from "./parse";

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

  it("maps Qualys columns (QID, Title, Severity, CVSS Base, IP, CVE ID)", () => {
    const csv = [`QID,Title,Severity,CVSS Base,IP,CVE ID,Solution`, `38170,SSL Certificate expired,4,7.4,10.1.1.9,CVE-2023-0001,Renew certificate`].join("\n");
    const out = parseCsv(csv);
    expect(out[0].pluginId).toBe("38170");
    expect(out[0].title).toBe("SSL Certificate expired");
    expect(out[0].cvss).toBe(7.4);
    expect(out[0].host).toBe("10.1.1.9");
    expect(out[0].cve).toBe("CVE-2023-0001");
  });

  it("maps OpenVAS columns (NVT Name, CVEs, Severity, Hostname)", () => {
    const csv = [`IP,Hostname,Port,CVEs,NVT Name,Severity,Summary`, `10.2.2.2,web01,443/tcp,CVE-2022-2222,TLS weak ciphers,6.5,Weak ciphers detected`].join("\n");
    const out = parseCsv(csv);
    expect(out[0].title).toBe("TLS weak ciphers");
    expect(out[0].host).toBe("10.2.2.2");
    expect(out[0].cve).toBe("CVE-2022-2222");
    expect(out[0].severity).toBe("6.5");
  });

  it("maps Microsoft Defender columns (CveId, Vulnerability Name, Device Name)", () => {
    const csv = [`CveId,Vulnerability Name,Severity,Cvss,Device Name,Recommendation`, `CVE-2024-9999,Outdated Chrome,High,8.8,LAPTOP-01,Update Chrome`].join("\n");
    const out = parseCsv(csv);
    expect(out[0].title).toBe("Outdated Chrome");
    expect(out[0].cve).toBe("CVE-2024-9999");
    expect(out[0].host).toBe("LAPTOP-01");
    expect(out[0].solution).toBe("Update Chrome");
  });
});

describe("detectCsvSource", () => {
  it("identifies each scanner from signature columns", () => {
    expect(detectCsvSource(["QID", "Title", "Severity"])).toBe("Qualys");
    expect(detectCsvSource(["IP", "NVT Name", "CVEs"])).toBe("OpenVAS");
    expect(detectCsvSource(["CveId", "Device Name", "Severity"])).toBe("Defender");
    expect(detectCsvSource(["Vulnerability ID", "Vulnerability Title"])).toBe("Rapid7");
    expect(detectCsvSource(["Plugin ID", "Name", "Host"])).toBe("CSV");
  });

  it("parseScan labels a Qualys CSV as Qualys", () => {
    expect(parseScan("export.csv", "QID,Title,IP\n1,Test,10.0.0.1").source).toBe("Qualys");
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
