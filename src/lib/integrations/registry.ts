import type { ConnectorMeta, IntegrationType } from "./types";

const COMMON_SCANNER_FIELDS = [
  { key: "mock", label: "Mock mode (use sample data, no live calls)", type: "checkbox" as const },
  { key: "baseUrl", label: "Base URL", type: "text" as const, placeholder: "https://cloud.tenable.com" },
  { key: "accessKey", label: "Access key / username", type: "password" as const },
  { key: "secretKey", label: "Secret key / password", type: "password" as const },
];

export const REGISTRY: Record<IntegrationType, ConnectorMeta> = {
  TENABLE: {
    type: "TENABLE",
    label: "Tenable.io",
    category: "SCANNER",
    capabilities: ["SYNC"],
    description: "Pull vulnerability findings into the analysis pipeline.",
    configFields: COMMON_SCANNER_FIELDS,
  },
  QUALYS: {
    type: "QUALYS",
    label: "Qualys VMDR",
    category: "SCANNER",
    capabilities: ["SYNC"],
    description: "Pull host vulnerability detections into the analysis pipeline.",
    configFields: COMMON_SCANNER_FIELDS,
  },
  SERVICENOW: {
    type: "SERVICENOW",
    label: "ServiceNow",
    category: "ITSM",
    capabilities: ["PUSH"],
    description: "Push POA&M remediation work to ServiceNow incidents.",
    configFields: [
      { key: "mock", label: "Mock mode (don't call ServiceNow)", type: "checkbox" },
      { key: "baseUrl", label: "Instance URL", type: "text", placeholder: "https://acme.service-now.com" },
      { key: "accessKey", label: "Username", type: "password" },
      { key: "secretKey", label: "Password", type: "password" },
    ],
  },
  SHAREPOINT: {
    type: "SHAREPOINT",
    label: "SharePoint / M365",
    category: "REPOSITORY",
    capabilities: ["SYNC", "LINK"],
    description: "Pull evidence documents from a SharePoint library into the evidence vault via Microsoft Graph.",
    configFields: [
      { key: "mock", label: "Mock mode (use sample documents, no live calls)", type: "checkbox" },
      { key: "tenantId", label: "Azure AD tenant ID", type: "text", placeholder: "00000000-0000-0000-0000-000000000000" },
      { key: "clientId", label: "App (client) ID", type: "text" },
      { key: "clientSecret", label: "Client secret", type: "password" },
      { key: "siteId", label: "Graph site ID", type: "text", placeholder: "contoso.sharepoint.com,<siteGuid>,<webGuid>" },
      { key: "folderPath", label: "Folder path (optional)", type: "text", placeholder: "Evidence/ATO" },
    ],
  },
  EMASS: {
    type: "EMASS",
    label: "eMASS export",
    category: "GRC",
    capabilities: ["EXPORT"],
    description: "Export POA&Ms in an eMASS-style CSV layout for upload.",
    configFields: [],
  },
  GITHUB: {
    type: "GITHUB",
    label: "GitHub",
    category: "CODE",
    capabilities: ["CHECK"],
    description: "Continuously test GitHub org settings: 2FA, branch protection, and admin count.",
    configFields: [
      { key: "mock", label: "Mock mode (use sample data, no live calls)", type: "checkbox" },
      { key: "org", label: "GitHub organization login", type: "text", placeholder: "lustrew" },
      { key: "token", label: "Personal access / App token", type: "password" },
    ],
  },
  M365: {
    type: "M365",
    label: "Microsoft 365 / Entra ID",
    category: "IDP",
    capabilities: ["CHECK"],
    description: "Continuously test Entra ID: MFA coverage, inactive users, admin count, audit logging.",
    configFields: [
      { key: "mock", label: "Mock mode (use sample data, no live calls)", type: "checkbox" },
      { key: "tenantId", label: "Azure AD tenant ID", type: "text" },
      { key: "clientId", label: "App (client) ID", type: "text" },
      { key: "clientSecret", label: "Client secret", type: "password" },
    ],
  },
  GOOGLE_WS: {
    type: "GOOGLE_WS",
    label: "Google Workspace",
    category: "IDP",
    capabilities: ["CHECK"],
    description: "Continuously test Google Workspace: 2-Step Verification, inactive users, super-admin count.",
    configFields: [
      { key: "mock", label: "Mock mode (use sample data, no live calls)", type: "checkbox" },
      { key: "adminEmail", label: "Admin email to impersonate", type: "text" },
      { key: "serviceAccountJson", label: "Service-account JSON", type: "password" },
    ],
  },
  AWS: {
    type: "AWS",
    label: "AWS",
    category: "CLOUD",
    capabilities: ["CHECK"],
    description: "Continuously test AWS: public buckets, encryption at rest, CloudTrail, IAM MFA & admins.",
    configFields: [
      { key: "mock", label: "Mock mode (use sample data, no live calls)", type: "checkbox" },
      { key: "accessKey", label: "Access key ID", type: "password" },
      { key: "secretKey", label: "Secret access key", type: "password" },
      { key: "roleArn", label: "Assume-role ARN (optional)", type: "text" },
      { key: "region", label: "Region", type: "text", placeholder: "us-east-1" },
    ],
  },
  OCI: {
    type: "OCI",
    label: "Oracle Cloud (OCI)",
    category: "CLOUD",
    capabilities: ["CHECK"],
    description: "Continuously test OCI: public Object Storage buckets, audit logging, IAM admins.",
    configFields: [
      { key: "mock", label: "Mock mode (use sample data, no live calls)", type: "checkbox" },
      { key: "accessKey", label: "API key / user OCID", type: "password" },
      { key: "secretKey", label: "Private key", type: "password" },
      { key: "region", label: "Region", type: "text", placeholder: "us-ashburn-1" },
    ],
  },
};

export const CONNECTORS: ConnectorMeta[] = Object.values(REGISTRY);
