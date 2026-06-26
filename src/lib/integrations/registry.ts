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
    capabilities: ["LINK"],
    description: "Reference evidence documents stored in SharePoint by link (no sync).",
    configFields: [{ key: "baseUrl", label: "Site URL", type: "text", placeholder: "https://acme.sharepoint.com/sites/ato" }],
  },
  EMASS: {
    type: "EMASS",
    label: "eMASS export",
    category: "GRC",
    capabilities: ["EXPORT"],
    description: "Export POA&Ms in an eMASS-style CSV layout for upload.",
    configFields: [],
  },
};

export const CONNECTORS: ConnectorMeta[] = Object.values(REGISTRY);
