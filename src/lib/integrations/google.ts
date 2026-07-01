import type { CheckConnector, IntegrationConfig, ProbeResult, TestResult } from "./types";

// Google Workspace CCM connector. Live mode requires a service-account JSON with domain-wide
// delegation (config.serviceAccountJson + config.adminEmail) and the Admin SDK Directory API —
// which needs signed JWT assertions. That signing path is not bundled in this build, so live mode
// returns an explicit ERROR (mirrors the Qualys precedent); mock mode is fully functional.

function liveUnavailable(): never {
  throw new Error("Google Workspace live mode is not enabled in this build — use mock mode.");
}

export const googleConnector: CheckConnector = {
  async testConnection(config: IntegrationConfig): Promise<TestResult> {
    if (config.mock) return { ok: true, message: "Mock mode — no live call." };
    if (!config.serviceAccountJson || !config.adminEmail) {
      return { ok: false, message: "serviceAccountJson and adminEmail are required" };
    }
    return { ok: false, message: "Live mode not enabled in this build — use mock mode." };
  },
  probes: {
    async listUsersMfaStatus(config): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      return { status: "FAIL", details: "5 of 30 users do not have 2-Step Verification enrolled.", evidence: { users: 30, without2sv: 5 }, resourceCount: 30, failingCount: 5 };
    },
    async listInactiveUsers(config, params): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      const days = Number(params?.inactiveDays ?? 90);
      return { status: "PASS", details: `No accounts inactive > ${days} days.`, evidence: { inactive: 0, days }, failingCount: 0 };
    },
    async listSuperAdmins(config, params): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      const max = Number(params?.maxAdmins ?? 3);
      return { status: "PASS", details: `2 super admins (≤ ${max}).`, evidence: { superAdmins: 2, max }, resourceCount: 2, failingCount: 0 };
    },
  },
};
