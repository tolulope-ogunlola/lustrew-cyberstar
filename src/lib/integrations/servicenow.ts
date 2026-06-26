import type { IntegrationConfig } from "./types";

export type PushResult = { ok: boolean; ref?: string; message: string };

// Push a POA&M to ServiceNow as an incident. Mock mode returns a synthetic ticket number so the
// flow is verifiable without a live instance.
export async function pushPoamToServiceNow(
  config: IntegrationConfig,
  poam: { poamNumber: string; weaknessTitle: string; weaknessDescription: string; severity: string }
): Promise<PushResult> {
  if (config.mock) {
    const ref = `INC${String(Math.floor(100000 + Math.random() * 900000))}`;
    return { ok: true, ref, message: `Mock: created ${ref}` };
  }
  if (!config.baseUrl || !config.accessKey || !config.secretKey) {
    return { ok: false, message: "Instance URL, username, and password are required." };
  }
  const urgency = poam.severity === "CRITICAL" || poam.severity === "HIGH" ? "1" : "2";
  try {
    const res = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/now/table/incident`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${config.accessKey}:${config.secretKey}`).toString("base64"),
      },
      body: JSON.stringify({
        short_description: `${poam.poamNumber}: ${poam.weaknessTitle}`,
        description: poam.weaknessDescription,
        urgency,
        category: "security",
      }),
    });
    if (!res.ok) return { ok: false, message: `ServiceNow returned ${res.status}` };
    const data = (await res.json()) as { result?: { number?: string } };
    return { ok: true, ref: data.result?.number, message: `Created ${data.result?.number ?? "incident"}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Push failed" };
  }
}
