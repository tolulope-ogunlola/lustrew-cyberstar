// CMMC 2.0 / NIST SP 800-171 Rev2 reference data. Pure, dependency-free — unit tested.

export const NIST_800_171_FAMILIES: Record<string, string> = {
  "3.1": "Access Control",
  "3.2": "Awareness and Training",
  "3.3": "Audit and Accountability",
  "3.4": "Configuration Management",
  "3.5": "Identification and Authentication",
  "3.6": "Incident Response",
  "3.7": "Maintenance",
  "3.8": "Media Protection",
  "3.9": "Personnel Security",
  "3.10": "Physical Protection",
  "3.11": "Risk Assessment",
  "3.12": "Security Assessment",
  "3.13": "System and Communications Protection",
  "3.14": "System and Information Integrity",
};

// CMMC Level 1 = the 17 FAR 52.204-21 basic safeguarding practices, expressed as their
// corresponding 800-171 requirement IDs.
export const CMMC_L1_REQUIREMENTS = [
  "3.1.1", "3.1.2", "3.1.20", "3.1.22",
  "3.5.1", "3.5.2",
  "3.8.3",
  "3.10.1", "3.10.3", "3.10.4", "3.10.5",
  "3.13.1", "3.13.5",
  "3.14.1", "3.14.2", "3.14.4", "3.14.5",
] as const;

export type CmmcLevel = "CMMC_L1" | "CMMC_L2" | "NIST_800_171";

// Which 800-171 requirement IDs apply for a given framework selection. L2 / 800-171 = all 110;
// L1 = the 17-practice subset. `all171Ids` is the full ordered set from the catalog.
export function requirementsForLevel(level: CmmcLevel, all171Ids: string[]): string[] {
  if (level === "CMMC_L1") {
    const l1 = new Set<string>(CMMC_L1_REQUIREMENTS);
    return all171Ids.filter((id) => l1.has(id));
  }
  return all171Ids; // CMMC_L2 and NIST_800_171 cover all 110
}

export function familyName(familyCode: string): string {
  return NIST_800_171_FAMILIES[familyCode] ?? familyCode;
}

// Family-level crosswalk: 800-171 family -> related NIST 800-53 Rev5 control families. Lets teams
// reuse 800-53 evidence/implementations when working a CMMC engagement.
export const CROSSWALK_171_TO_53: Record<string, string[]> = {
  "3.1": ["AC"],
  "3.2": ["AT"],
  "3.3": ["AU"],
  "3.4": ["CM"],
  "3.5": ["IA"],
  "3.6": ["IR"],
  "3.7": ["MA"],
  "3.8": ["MP"],
  "3.9": ["PS"],
  "3.10": ["PE"],
  "3.11": ["RA"],
  "3.12": ["CA"],
  "3.13": ["SC"],
  "3.14": ["SI"],
};

// Does a system's framework selection include a CMMC / 800-171 scope?
export function isCmmcFramework(fw: string): boolean {
  return fw === "CMMC_L1" || fw === "CMMC_L2" || fw === "NIST_800_171";
}
