// Maps the framework labels a System opts into (src/lib/validation.ts FRAMEWORKS) to the
// control-catalog discriminators stored on Control.framework. Several labels share one catalog
// (e.g. FISMA / FEDRAMP_READY both ride the NIST 800-53 catalog); the commercial frameworks each
// have their own seeded catalog.

export type CatalogKey =
  | "NIST_800_53"
  | "NIST_800_171"
  | "SOC2"
  | "ISO_27001"
  | "HIPAA"
  | "ISO_42001";

export const COMMERCIAL_CATALOGS: CatalogKey[] = ["SOC2", "ISO_27001", "HIPAA", "ISO_42001"];

// Framework labels that ride the NIST 800-53 catalog.
const NIST53_LABELS = ["NIST_RMF", "NIST_800_53", "NIST_800_37", "FISMA", "FEDRAMP_READY"];
// Framework labels that ride the NIST 800-171 catalog.
const NIST171_LABELS = ["NIST_800_171", "CMMC_L1", "CMMC_L2"];

export const FRAMEWORK_CATALOG_LABEL: Record<CatalogKey, string> = {
  NIST_800_53: "NIST SP 800-53 Rev 5",
  NIST_800_171: "NIST SP 800-171 Rev 2",
  SOC2: "SOC 2 (Trust Services Criteria)",
  ISO_27001: "ISO/IEC 27001:2022 (Annex A)",
  HIPAA: "HIPAA Security Rule",
  ISO_42001: "ISO/IEC 42001:2023 (AI, Annex A)",
};

/** Which control catalogs a set of selected framework labels resolves to. */
export function catalogsForFrameworks(frameworks: string[]): {
  wants53: boolean;
  wants171: boolean;
  l1Only: boolean;
  commercial: CatalogKey[];
} {
  const wants53 = frameworks.some((f) => NIST53_LABELS.includes(f));
  const wants171 = frameworks.some((f) => NIST171_LABELS.includes(f));
  const l1Only =
    wants171 &&
    frameworks.includes("CMMC_L1") &&
    !frameworks.includes("CMMC_L2") &&
    !frameworks.includes("NIST_800_171");
  const commercial = COMMERCIAL_CATALOGS.filter((c) => frameworks.includes(c));
  return { wants53, wants171, l1Only, commercial };
}

export function isCatalogKey(value: string): value is CatalogKey {
  return value in FRAMEWORK_CATALOG_LABEL;
}
