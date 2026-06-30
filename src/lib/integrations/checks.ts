import type { CheckConnector } from "./types";
import { githubConnector } from "./github";
import { microsoftConnector } from "./microsoft";
import { googleConnector } from "./google";
import { awsConnector } from "./aws";

// Maps a Check.providerType (== Integration.type) to its CheckConnector. OCI reuses the AWS-shaped
// connector. Adding a provider is just one entry here plus a registry entry + connector file.
export const CHECK_CONNECTORS: Record<string, CheckConnector> = {
  GITHUB: githubConnector,
  M365: microsoftConnector,
  GOOGLE_WS: googleConnector,
  AWS: awsConnector,
  OCI: awsConnector,
};

export function getCheckConnector(providerType: string): CheckConnector | undefined {
  return CHECK_CONNECTORS[providerType];
}
