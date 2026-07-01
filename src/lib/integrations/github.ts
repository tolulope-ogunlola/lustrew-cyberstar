import type { CheckConnector, IntegrationConfig, ProbeResult, TestResult } from "./types";

// GitHub CCM connector. Live mode uses the REST API with a PAT or App installation token
// (config.token) scoped to an org (config.org). Mock mode returns deterministic sample results
// so the engine can be demoed/tested without credentials.

const GH = "https://api.github.com";

function headers(config: IntegrationConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghGet(path: string, config: IntegrationConfig): Promise<unknown> {
  const res = await fetch(`${GH}${path}`, { headers: headers(config) });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}`);
  return res.json();
}

export const githubConnector: CheckConnector = {
  async testConnection(config: IntegrationConfig): Promise<TestResult> {
    if (config.mock) return { ok: true, message: "Mock mode — no live call." };
    if (!config.token || !config.org) return { ok: false, message: "token and org are required" };
    try {
      await ghGet(`/orgs/${config.org}`, config);
      return { ok: true, message: `Connected to org ${config.org}.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
  probes: {
    // Org members with 2FA disabled → fail if any.
    async listUsersMfaStatus(config): Promise<ProbeResult> {
      if (config.mock) {
        return { status: "PASS", details: "All 12 org members have 2FA enabled.", evidence: { members: 12, without2fa: 0 }, resourceCount: 12, failingCount: 0 };
      }
      const members = (await ghGet(`/orgs/${config.org}/members?filter=2fa_disabled&per_page=100`, config)) as unknown[];
      const failing = members.length;
      return {
        status: failing === 0 ? "PASS" : "FAIL",
        details: failing === 0 ? "All org members have 2FA enabled." : `${failing} member(s) without 2FA.`,
        evidence: { without2fa: failing },
        failingCount: failing,
      };
    },
    // Default branch protection across repos.
    async listRepoBranchProtection(config): Promise<ProbeResult> {
      if (config.mock) {
        return { status: "FAIL", details: "2 of 8 repos have an unprotected default branch.", evidence: { repos: 8, unprotected: ["legacy-api", "scratch"] }, resourceCount: 8, failingCount: 2 };
      }
      const repos = (await ghGet(`/orgs/${config.org}/repos?per_page=100&type=all`, config)) as { name: string; default_branch: string; archived: boolean }[];
      const unprotected: string[] = [];
      for (const r of repos) {
        if (r.archived) continue;
        try {
          const res = await fetch(`${GH}/repos/${config.org}/${r.name}/branches/${r.default_branch}/protection`, { headers: headers(config) });
          if (res.status === 404) unprotected.push(r.name);
        } catch {
          unprotected.push(r.name);
        }
      }
      return {
        status: unprotected.length === 0 ? "PASS" : "FAIL",
        details: unprotected.length === 0 ? "All default branches are protected." : `${unprotected.length} repo(s) with unprotected default branch.`,
        evidence: { repos: repos.length, unprotected },
        resourceCount: repos.length,
        failingCount: unprotected.length,
      };
    },
    // Org owners/admins count vs threshold (params.maxAdmins).
    async listOrgAdmins(config, params): Promise<ProbeResult> {
      const max = Number(params?.maxAdmins ?? 4);
      if (config.mock) {
        return { status: "PASS", details: `3 org admins (≤ ${max}).`, evidence: { admins: 3, max }, resourceCount: 3, failingCount: 0 };
      }
      const admins = (await ghGet(`/orgs/${config.org}/members?role=admin&per_page=100`, config)) as unknown[];
      const over = admins.length > max;
      return {
        status: over ? "FAIL" : "PASS",
        details: `${admins.length} org admin(s) (threshold ${max}).`,
        evidence: { admins: admins.length, max },
        resourceCount: admins.length,
        failingCount: over ? admins.length - max : 0,
      };
    },
  },
};
