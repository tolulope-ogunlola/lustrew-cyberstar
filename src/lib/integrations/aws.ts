import type { CheckConnector, IntegrationConfig, ProbeResult, TestResult } from "./types";

// AWS / OCI cloud CCM connector. Live mode requires SigV4-signed API calls (or the AWS SDK),
// which are not bundled in this build, so live mode returns an explicit ERROR (mirrors the Qualys
// precedent). Mock mode is fully functional and drives the demo/tests. The same connector shape is
// reused for OCI (Object Storage public buckets, audit logging, IAM admins).

function liveUnavailable(): never {
  throw new Error("Cloud live mode is not enabled in this build — use mock mode.");
}

export const awsConnector: CheckConnector = {
  async testConnection(config: IntegrationConfig): Promise<TestResult> {
    if (config.mock) return { ok: true, message: "Mock mode — no live call." };
    if (!config.accessKey && !config.roleArn) {
      return { ok: false, message: "accessKey/secretKey or roleArn is required" };
    }
    return { ok: false, message: "Live mode not enabled in this build — use mock mode." };
  },
  probes: {
    async listPublicBuckets(config): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      return { status: "FAIL", details: "1 storage bucket is publicly accessible.", evidence: { buckets: 14, public: ["legacy-assets"] }, resourceCount: 14, failingCount: 1 };
    },
    async ebsEncryptionEnabled(config): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      return { status: "PASS", details: "Default volume encryption is enabled in all regions.", evidence: { encryptedByDefault: true } };
    },
    async cloudTrailEnabled(config): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      return { status: "PASS", details: "A multi-region trail is logging to a protected bucket.", evidence: { trails: 1, multiRegion: true } };
    },
    async listIamAdmins(config, params): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      const max = Number(params?.maxAdmins ?? 4);
      return { status: "PASS", details: `3 IAM principals with admin policy (≤ ${max}).`, evidence: { admins: 3, max }, resourceCount: 3, failingCount: 0 };
    },
    async mfaOnRootAndUsers(config): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      return { status: "FAIL", details: "2 IAM users with console access lack MFA.", evidence: { rootMfa: true, usersWithoutMfa: 2 }, failingCount: 2 };
    },
    async passwordPolicy(config): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      return { status: "PASS", details: "Account password policy meets minimum requirements.", evidence: { minLength: 14, requireSymbols: true } };
    },
    async tlsInTransit(config): Promise<ProbeResult> {
      if (!config.mock) liveUnavailable();
      return { status: "PASS", details: "Load balancers enforce TLS 1.2+ and buckets deny insecure transport.", evidence: { insecureListeners: 0 } };
    },
  },
};
