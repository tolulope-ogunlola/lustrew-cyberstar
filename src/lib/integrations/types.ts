import type { ParsedVuln } from "@/lib/vuln/parse";

export type IntegrationType =
  | "TENABLE"
  | "QUALYS"
  | "SERVICENOW"
  | "SHAREPOINT"
  | "EMASS"
  | "GITHUB"
  | "M365"
  | "GOOGLE_WS"
  | "AWS"
  | "OCI";
export type Capability = "SYNC" | "PUSH" | "EXPORT" | "LINK" | "CHECK";
export type Category = "SCANNER" | "ITSM" | "REPOSITORY" | "GRC" | "CLOUD" | "IDP" | "CODE";

export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "checkbox";
  placeholder?: string;
};

export type ConnectorMeta = {
  type: IntegrationType;
  label: string;
  category: Category;
  capabilities: Capability[];
  description: string;
  configFields: ConfigField[];
};

export type IntegrationConfig = {
  mock?: boolean;
  baseUrl?: string;
  accessKey?: string;
  secretKey?: string;
  // Microsoft Graph / SharePoint / M365 (Azure AD app, client-credentials)
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  siteId?: string;
  folderPath?: string;
  // CCM connectors
  token?: string; // GitHub PAT / App installation token
  org?: string; // GitHub org login
  serviceAccountJson?: string; // Google service-account JSON (domain-wide delegation)
  adminEmail?: string; // Google admin subject to impersonate
  roleArn?: string; // AWS assumed role
  region?: string; // AWS/OCI region
  [k: string]: unknown;
};

export type TestResult = { ok: boolean; message: string };

/** Scanner connectors pull vulnerability findings to feed the shared ingest pipeline. */
export interface ScannerConnector {
  testConnection(config: IntegrationConfig): Promise<TestResult>;
  fetchFindings(config: IntegrationConfig): Promise<ParsedVuln[]>;
}

/** A document pulled from a content repository (e.g. SharePoint) to register as evidence. */
export type RepoDoc = {
  name: string;
  url: string; // canonical link (Graph webUrl)
  contentType?: string;
  size?: number;
  modifiedAt?: string;
};

/** Repository connectors pull evidence documents to register in the evidence vault. */
export interface RepositoryConnector {
  testConnection(config: IntegrationConfig): Promise<TestResult>;
  fetchDocuments(config: IntegrationConfig): Promise<RepoDoc[]>;
}

// --- Continuous Controls Monitoring (CCM) ---

// Normalized output of a single check probe so the engine stays provider-agnostic.
export type ProbeResult = {
  status: "PASS" | "FAIL" | "ERROR";
  details: string;
  evidence: Record<string, unknown>; // raw payload, stored in CheckResult.evidenceJson
  resourceCount?: number;
  failingCount?: number;
};

export type Probe = (config: IntegrationConfig, params?: Record<string, unknown>) => Promise<ProbeResult>;

/** Check connectors expose named probes that the CCM engine runs on a schedule. */
export interface CheckConnector {
  testConnection(config: IntegrationConfig): Promise<TestResult>;
  probes: Record<string, Probe>;
}
