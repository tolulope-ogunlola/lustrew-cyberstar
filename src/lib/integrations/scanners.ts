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

function authHeaderTenable(c: IntegrationConfig): Record<string, string> {
  return { "X-ApiKeys": `accessKey=${c.accessKey ?? ""}; secretKey=${c.secretKey ?? ""}`, Accept: "application/json" };
}

// Tenable.io — mock returns sample data; live mode performs a best-effort export read.
const tenable: ScannerConnector = {
  async testConnection(c) {
    if (c.mock) return { ok: true, message: "Mock mode — no live call made." };
    if (!c.baseUrl || !c.accessKey || !c.secretKey) return { ok: false, message: "baseUrl, accessKey, and secretKey are required." };
    try {
      const res = await fetch(`${c.baseUrl.replace(/\/$/, "")}/server/properties`, { headers: authHeaderTenable(c) });
      return res.ok ? { ok: true, message: "Connected to Tenable." } : { ok: false, message: `Tenable returned ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
  async fetchFindings(c) {
    if (c.mock) return TENABLE_SAMPLE;
    // Live: read the latest vulnerabilities export. Mapping kept minimal; mock path is the tested one.
    const res = await fetch(`${c.baseUrl!.replace(/\/$/, "")}/workbenches/vulnerabilities`, { headers: authHeaderTenable(c) });
    if (!res.ok) throw new Error(`Tenable returned ${res.status}`);
    const data = (await res.json()) as { vulnerabilities?: Array<Record<string, unknown>> };
    return (data.vulnerabilities ?? []).map((v) => ({
      pluginId: String(v.plugin_id ?? ""),
      title: String(v.plugin_name ?? "Finding"),
      severity: String(v.severity ?? "info"),
      cvss: typeof v.cvss_base_score === "number" ? v.cvss_base_score : undefined,
    }));
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
    throw new Error("Live Qualys pull is not enabled in this build — use mock mode or file import.");
  },
};

export const SCANNERS: Record<string, ScannerConnector> = { TENABLE: tenable, QUALYS: qualys };
