import type { CheckConnector, IntegrationConfig, ProbeResult, TestResult } from "./types";

// Microsoft 365 / Entra ID CCM connector. Live mode uses Microsoft Graph with the same
// client-credentials flow as the SharePoint connector (tenantId/clientId/clientSecret).
// Mock mode returns deterministic sample results.

const GRAPH = "https://graph.microsoft.com/v1.0";

async function graphToken(config: IntegrationConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId ?? "",
    client_secret: config.clientSecret ?? "",
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Entra token error ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function graphGet(path: string, token: string): Promise<{ value?: unknown[] }> {
  const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Graph ${res.status} on ${path}`);
  return res.json();
}

export const microsoftConnector: CheckConnector = {
  async testConnection(config: IntegrationConfig): Promise<TestResult> {
    if (config.mock) return { ok: true, message: "Mock mode — no live call." };
    if (!config.tenantId || !config.clientId || !config.clientSecret) {
      return { ok: false, message: "tenantId, clientId and clientSecret are required" };
    }
    try {
      await graphToken(config);
      return { ok: true, message: "Authenticated to Microsoft Graph." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
  probes: {
    async listUsersMfaStatus(config): Promise<ProbeResult> {
      if (config.mock) {
        return { status: "PASS", details: "All 48 users are registered for MFA.", evidence: { users: 48, withoutMfa: 0 }, resourceCount: 48, failingCount: 0 };
      }
      const token = await graphToken(config);
      const data = await graphGet(`/reports/authenticationMethods/userRegistrationDetails?$top=999`, token);
      const users = data.value ?? [];
      const without = users.filter((u) => !(u as { isMfaRegistered?: boolean }).isMfaRegistered).length;
      return {
        status: without === 0 ? "PASS" : "FAIL",
        details: without === 0 ? "All users registered for MFA." : `${without} user(s) without MFA.`,
        evidence: { users: users.length, withoutMfa: without },
        resourceCount: users.length,
        failingCount: without,
      };
    },
    async listInactiveUsers(config, params): Promise<ProbeResult> {
      const days = Number(params?.inactiveDays ?? 90);
      if (config.mock) {
        return { status: "FAIL", details: `3 enabled accounts inactive > ${days} days.`, evidence: { inactive: 3, days }, failingCount: 3 };
      }
      const token = await graphToken(config);
      // Best-effort: requires AAD Premium sign-in activity. Surface ERROR if unavailable.
      const data = await graphGet(`/users?$select=displayName,accountEnabled,signInActivity&$top=999`, token);
      const cutoff = Date.now() - days * 86_400_000;
      const inactive = (data.value ?? []).filter((u) => {
        const x = u as { accountEnabled?: boolean; signInActivity?: { lastSignInDateTime?: string } };
        if (!x.accountEnabled) return false;
        const last = x.signInActivity?.lastSignInDateTime ? Date.parse(x.signInActivity.lastSignInDateTime) : 0;
        return last < cutoff;
      }).length;
      return {
        status: inactive === 0 ? "PASS" : "FAIL",
        details: `${inactive} enabled account(s) inactive > ${days} days.`,
        evidence: { inactive, days },
        failingCount: inactive,
      };
    },
    async listAdmins(config, params): Promise<ProbeResult> {
      const max = Number(params?.maxAdmins ?? 5);
      if (config.mock) {
        return { status: "PASS", details: `4 directory admins (≤ ${max}).`, evidence: { admins: 4, max }, resourceCount: 4, failingCount: 0 };
      }
      const token = await graphToken(config);
      // Global Administrator role members.
      const data = await graphGet(`/directoryRoles(roleTemplateId='62e90394-69f5-4237-9190-012177145e10')/members`, token);
      const admins = (data.value ?? []).length;
      const over = admins > max;
      return {
        status: over ? "FAIL" : "PASS",
        details: `${admins} global admin(s) (threshold ${max}).`,
        evidence: { admins, max },
        resourceCount: admins,
        failingCount: over ? admins - max : 0,
      };
    },
    async auditLoggingEnabled(config): Promise<ProbeResult> {
      if (config.mock) {
        return { status: "PASS", details: "Unified audit log is enabled.", evidence: { auditLog: "enabled" } };
      }
      // Graph does not expose the unified audit-log toggle directly; treat presence of recent
      // directory audits as evidence it is enabled.
      const token = await graphToken(config);
      const data = await graphGet(`/auditLogs/directoryAudits?$top=1`, token);
      const enabled = (data.value ?? []).length > 0;
      return {
        status: enabled ? "PASS" : "FAIL",
        details: enabled ? "Directory audit logging is active." : "No directory audit records found.",
        evidence: { recentAudits: (data.value ?? []).length },
      };
    },
  },
};
