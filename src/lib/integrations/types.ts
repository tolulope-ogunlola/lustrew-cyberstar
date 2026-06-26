import type { ParsedVuln } from "@/lib/vuln/parse";

export type IntegrationType = "TENABLE" | "QUALYS" | "SERVICENOW" | "SHAREPOINT" | "EMASS";
export type Capability = "SYNC" | "PUSH" | "EXPORT" | "LINK";
export type Category = "SCANNER" | "ITSM" | "REPOSITORY" | "GRC";

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
  [k: string]: unknown;
};

export type TestResult = { ok: boolean; message: string };

/** Scanner connectors pull vulnerability findings to feed the shared ingest pipeline. */
export interface ScannerConnector {
  testConnection(config: IntegrationConfig): Promise<TestResult>;
  fetchFindings(config: IntegrationConfig): Promise<ParsedVuln[]>;
}
