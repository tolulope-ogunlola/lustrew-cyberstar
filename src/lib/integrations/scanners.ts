import type { ParsedVuln } from "@/lib/vuln/parse";
import type { IntegrationConfig, ScannerConnector, TestResult } from "./types";

// Sample findings returned in mock mode so the sync pipeline is verifiable without live API keys.
const TENABLE_SAMPLE: ParsedVuln[] = [
  { pluginId: "19506", cve: "CVE-2023-1234", title: "Apache HTTP Server outdated (RCE)", severity: "Critical", cvss: 9.8, host: "10.0.2.10", port: "443", solution: "Upgrade Apache" },
  { pluginId: "42873", cve: "CVE-2022-0001", title: "SSL Medium Strength Cipher Suites Supported", severity: "Medium", cvss: 5.3, host: "10.0.2.10", port: "443", solution: "Disable weak ciphers" },
  { pluginId: "10863", title: "SSL Certificate expires soon", severity: "Low", cvss: 3.1, host: "10.0.2.11", port: "443", solution: "Renew certificate" },
];

const QUALYS_SAMPLE: ParsedVuln[] = [
  { pluginId: "QID-105943", cve: "CVE-2023-5555", title: "OpenSSH vulnerable version detected", severity: "High", cvss: 7.5, host: "10.0.2.20", port: "22", solution: "Patch OpenSSH" },
  { pluginId: "QID-38170", title: "TLS 1.0 enabled", severity: "Medium", cvss: 5.0, host: "10.0.2.20", port: "443", solution: "Disable TLS 1.0" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const base = (c: IntegrationConfig) => (c.baseUrl || "https://cloud.tenable.com").replace(/\/$/, "");
function authHeaderTenable(c: IntegrationConfig): Record<string, string> {
  return { "X-ApiKeys": `accessKey=${c.accessKey ?? ""}; secretKey=${c.secretKey ?? ""}`, Accept: "application/json", "Content-Type": "application/json" };
}

// Tenable numeric severity (0..4) → label used by the prioritizer.
const TENABLE_SEVERITY = ["Info", "Low", "Medium", "High", "Critical"];

// Map one Tenable vulns-export instance to a ParsedVuln. Pure — unit tested.
export function mapTenableExportRow(v: Record<string, unknown>): ParsedVuln {
  const plugin = (v.plugin ?? {}) as Record<string, unknown>;
  const asset = (v.asset ?? {}) as Record<string, unknown>;
  const portObj = (v.port ?? {}) as Record<string, unknown>;
  const cves = Array.isArray(plugin.cve) ? (plugin.cve as string[]) : [];
  const sevNum = typeof v.severity_id === "number" ? v.severity_id : typeof v.severity === "number" ? v.severity : undefined;
  const severity = typeof v.severity === "string" ? v.severity : sevNum != null ? TENABLE_SEVERITY[sevNum] ?? "Info" : undefined;
  const cvss = typeof plugin.cvss3_base_score === "number" ? plugin.cvss3_base_score : typeof plugin.cvss_base_score === "number" ? plugin.cvss_base_score : undefined;
  return {
    pluginId: plugin.id != null ? String(plugin.id) : undefined,
    cve: cves[0],
    title: String(plugin.name ?? "Tenable finding"),
    description: typeof plugin.description === "string" ? plugin.description : undefined,
    solution: typeof plugin.solution === "string" ? plugin.solution : undefined,
    severity,
    cvss,
    host: String(asset.hostname ?? asset.ipv4 ?? asset.fqdn ?? "") || undefined,
    port: portObj.port != null ? String(portObj.port) : undefined,
  };
}

// Tenable.io — mock returns sample data; live mode runs the Vulns Export API
// (request export → poll status → download chunks). https://developer.tenable.com/reference/exports-vulns-request-export
const tenable: ScannerConnector = {
  async testConnection(c) {
    if (c.mock) return { ok: true, message: "Mock mode — no live call made." };
    if (!c.accessKey || !c.secretKey) return { ok: false, message: "accessKey and secretKey are required." };
    try {
      const res = await fetch(`${base(c)}/server/properties`, { headers: authHeaderTenable(c) });
      return res.ok ? { ok: true, message: "Connected to Tenable.io." } : { ok: false, message: `Tenable returned ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
  async fetchFindings(c) {
    if (c.mock) return TENABLE_SAMPLE;
    if (!c.accessKey || !c.secretKey) throw new Error("Tenable accessKey and secretKey are required.");
    const headers = authHeaderTenable(c);

    // 1) Request an export of open/reopened vulnerabilities.
    const reqRes = await fetch(`${base(c)}/vulns/export`, {
      method: "POST",
      headers,
      body: JSON.stringify({ num_assets: 50, filters: { state: ["OPEN", "REOPENED"] } }),
    });
    if (!reqRes.ok) throw new Error(`Tenable export request failed (${reqRes.status})`);
    const { export_uuid } = (await reqRes.json()) as { export_uuid: string };
    if (!export_uuid) throw new Error("Tenable did not return an export_uuid");

    // 2) Poll status until chunks are available (bounded: ~20 polls × 3s ≈ 60s).
    let chunks: number[] = [];
    for (let i = 0; i < 20; i++) {
      const stRes = await fetch(`${base(c)}/vulns/export/${export_uuid}/status`, { headers });
      if (!stRes.ok) throw new Error(`Tenable export status failed (${stRes.status})`);
      const st = (await stRes.json()) as { status: string; chunks_available?: number[] };
      chunks = st.chunks_available ?? [];
      if (st.status === "ERROR") throw new Error("Tenable export errored");
      if (st.status === "FINISHED" || chunks.length) break;
      await sleep(3000);
    }

    // 3) Download up to the first 10 chunks and map each instance.
    const out: ParsedVuln[] = [];
    for (const n of chunks.slice(0, 10)) {
      const chRes = await fetch(`${base(c)}/vulns/export/${export_uuid}/chunks/${n}`, { headers });
      if (!chRes.ok) continue;
      const rows = (await chRes.json()) as Array<Record<string, unknown>>;
      for (const r of rows) out.push(mapTenableExportRow(r));
    }
    return out;
  },
};

// Qualys VMDR — mock returns sample data; live mode best-effort.
const qualys: ScannerConnector = {
  async testConnection(c) {
    if (c.mock) return { ok: true, message: "Mock mode — no live call made." };
    if (!c.baseUrl || !c.accessKey || !c.secretKey) return { ok: false, message: "baseUrl, accessKey (username), and secretKey (password) are required." };
    try {
      const res = await fetch(`${c.baseUrl.replace(/\/$/, "")}/api/2.0/fo/about/`, {
        headers: { Authorization: "Basic " + Buffer.from(`${c.accessKey}:${c.secretKey}`).toString("base64"), "X-Requested-With": "CyberStar" },
      });
      return res.ok ? { ok: true, message: "Connected to Qualys." } : { ok: false, message: `Qualys returned ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
  async fetchFindings(c) {
    if (c.mock) return QUALYS_SAMPLE;
    throw new Error("Live Qualys pull is not enabled in this build — use mock mode or CSV import.");
  },
};

export const SCANNERS: Record<string, ScannerConnector> = { TENABLE: tenable, QUALYS: qualys };
