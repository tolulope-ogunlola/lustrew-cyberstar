import { describe, expect, it } from "vitest";
import { parseCkl, stigSlaDays, stigToPoamSeverity } from "./parse";

const CKL = `<?xml version="1.0"?>
<CHECKLIST>
  <ASSET><HOST_NAME>web01</HOST_NAME></ASSET>
  <STIGS><iSTIG>
    <STIG_INFO>
      <SI_DATA><SID_NAME>title</SID_NAME><SID_DATA>RHEL 8 STIG</SID_DATA></SI_DATA>
    </STIG_INFO>
    <VULN>
      <STIG_DATA><VULN_ATTRIBUTE>Vuln_Num</VULN_ATTRIBUTE><ATTRIBUTE_DATA>V-230221</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Rule_ID</VULN_ATTRIBUTE><ATTRIBUTE_DATA>SV-230221r1</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Severity</VULN_ATTRIBUTE><ATTRIBUTE_DATA>high</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Rule_Title</VULN_ATTRIBUTE><ATTRIBUTE_DATA>RHEL 8 must enable FIPS mode</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>CCI_REF</VULN_ATTRIBUTE><ATTRIBUTE_DATA>CCI-000068</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>CCI_REF</VULN_ATTRIBUTE><ATTRIBUTE_DATA>CCI-002450</ATTRIBUTE_DATA></STIG_DATA>
      <STATUS>Open</STATUS>
      <FINDING_DETAILS>FIPS not enabled</FINDING_DETAILS>
      <COMMENTS>scheduled</COMMENTS>
    </VULN>
    <VULN>
      <STIG_DATA><VULN_ATTRIBUTE>Vuln_Num</VULN_ATTRIBUTE><ATTRIBUTE_DATA>V-230222</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Severity</VULN_ATTRIBUTE><ATTRIBUTE_DATA>low</ATTRIBUTE_DATA></STIG_DATA>
      <STIG_DATA><VULN_ATTRIBUTE>Rule_Title</VULN_ATTRIBUTE><ATTRIBUTE_DATA>Banner must be configured</ATTRIBUTE_DATA></STIG_DATA>
      <STATUS>NotAFinding</STATUS>
    </VULN>
  </iSTIG></STIGS>
</CHECKLIST>`;

describe("parseCkl", () => {
  it("extracts vulns with severity (CAT), status, CCI, host, and STIG name", () => {
    const out = parseCkl(CKL);
    expect(out).toHaveLength(2);
    const v1 = out[0];
    expect(v1.vulnNum).toBe("V-230221");
    expect(v1.severity).toBe("CAT_I");
    expect(v1.status).toBe("OPEN");
    expect(v1.host).toBe("web01");
    expect(v1.stigName).toBe("RHEL 8 STIG");
    expect(v1.cci).toBe("CCI-000068, CCI-002450");
    expect(out[1].severity).toBe("CAT_III");
    expect(out[1].status).toBe("NOT_A_FINDING");
  });

  it("rejects non-ckl XML", () => {
    expect(() => parseCkl("<foo/>")).toThrow();
  });
});

describe("stig severity mapping", () => {
  it("maps CAT to POA&M severity and SLA", () => {
    expect(stigToPoamSeverity("CAT_I")).toBe("HIGH");
    expect(stigToPoamSeverity("CAT_II")).toBe("MODERATE");
    expect(stigToPoamSeverity("CAT_III")).toBe("LOW");
    expect(stigSlaDays("CAT_I")).toBe(30);
    expect(stigSlaDays("CAT_III")).toBe(180);
  });
});
