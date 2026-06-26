import type { IntegrationConfig, RepoDoc, RepositoryConnector } from "./types";

const GRAPH = "https://graph.microsoft.com/v1.0";

const SHAREPOINT_SAMPLE: RepoDoc[] = [
  { name: "Access Control Policy.pdf", url: "https://contoso.sharepoint.com/sites/ato/Shared%20Documents/Access%20Control%20Policy.pdf", contentType: "application/pdf", size: 184320, modifiedAt: "2026-05-02T12:00:00Z" },
  { name: "Incident Response Plan.docx", url: "https://contoso.sharepoint.com/sites/ato/Shared%20Documents/Incident%20Response%20Plan.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 96512, modifiedAt: "2026-04-18T09:30:00Z" },
  { name: "Q1 Access Review.xlsx", url: "https://contoso.sharepoint.com/sites/ato/Shared%20Documents/Q1%20Access%20Review.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 51200, modifiedAt: "2026-03-31T16:45:00Z" },
];

// Map Microsoft Graph driveItem objects to RepoDocs (files only). Pure — unit tested.
export function mapGraphItems(items: Array<Record<string, unknown>>): RepoDoc[] {
  return items
    .filter((it) => it.file) // skip folders
    .map((it) => {
      const file = (it.file ?? {}) as Record<string, unknown>;
      return {
        name: String(it.name ?? "document"),
        url: String(it.webUrl ?? ""),
        contentType: typeof file.mimeType === "string" ? file.mimeType : undefined,
        size: typeof it.size === "number" ? it.size : undefined,
        modifiedAt: typeof it.lastModifiedDateTime === "string" ? it.lastModifiedDateTime : undefined,
      };
    })
    .filter((d) => d.url);
}

// OAuth2 client-credentials token for Microsoft Graph (app-only access).
async function graphToken(c: IntegrationConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: c.clientId ?? "",
    client_secret: c.clientSecret ?? "",
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Azure AD token request failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Azure AD did not return an access token");
  return json.access_token;
}

const hasCreds = (c: IntegrationConfig) => Boolean(c.tenantId && c.clientId && c.clientSecret && c.siteId);

const sharepoint: RepositoryConnector = {
  async testConnection(c) {
    if (c.mock) return { ok: true, message: "Mock mode — no live call made." };
    if (!hasCreds(c)) return { ok: false, message: "tenantId, clientId, clientSecret, and siteId are required." };
    try {
      const token = await graphToken(c);
      const res = await fetch(`${GRAPH}/sites/${encodeURIComponent(c.siteId!)}/drive`, { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? { ok: true, message: "Connected to SharePoint via Microsoft Graph." } : { ok: false, message: `Graph returned ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  },
  async fetchDocuments(c) {
    if (c.mock) return SHAREPOINT_SAMPLE;
    if (!hasCreds(c)) throw new Error("SharePoint requires tenantId, clientId, clientSecret, and siteId.");
    const token = await graphToken(c);
    // List children of a named folder, or the drive root when no folder is given.
    const folder = (c.folderPath ?? "").trim().replace(/^\/|\/$/g, "");
    const path = folder
      ? `${GRAPH}/sites/${encodeURIComponent(c.siteId!)}/drive/root:/${folder}:/children`
      : `${GRAPH}/sites/${encodeURIComponent(c.siteId!)}/drive/root/children`;

    const docs: RepoDoc[] = [];
    let next: string | null = `${path}?$top=100`;
    for (let i = 0; i < 10 && next; i++) {
      const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Graph list failed (${res.status})`);
      const json = (await res.json()) as { value?: Array<Record<string, unknown>>; "@odata.nextLink"?: string };
      docs.push(...mapGraphItems(json.value ?? []));
      next = json["@odata.nextLink"] ?? null;
    }
    return docs;
  },
};

export const REPOSITORIES: Record<string, RepositoryConnector> = { SHAREPOINT: sharepoint };
