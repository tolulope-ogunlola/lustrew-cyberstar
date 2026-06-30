// Framework crosswalk: maps NIST 800-53 Rev 5 control families to their nearest equivalents in
// CMMC 2.0 (Level 2), ISO/IEC 27001:2022 Annex A, and SOC 2 Trust Services Criteria.
//
// Mappings are at the family level — the pragmatic, defensible granularity for a readiness view.
// They are directional aids for scoping reciprocity, NOT an authoritative one-to-one assertion;
// always confirm individual control applicability for a given authorization.

export type CrosswalkRow = {
  family: string; // 800-53 family code, e.g. "AC"
  familyName: string;
  cmmc: string; // CMMC 2.0 L2 domain(s)
  iso27001: string; // ISO/IEC 27001:2022 Annex A reference(s)
  soc2: string; // SOC 2 Trust Services Criteria
};

export const CROSSWALKS: CrosswalkRow[] = [
  { family: "AC", familyName: "Access Control", cmmc: "AC", iso27001: "A.5.15–A.5.18, A.8.2–A.8.5", soc2: "CC6.1, CC6.2, CC6.3" },
  { family: "AT", familyName: "Awareness & Training", cmmc: "AT", iso27001: "A.6.3", soc2: "CC1.4, CC2.2" },
  { family: "AU", familyName: "Audit & Accountability", cmmc: "AU", iso27001: "A.8.15, A.8.16", soc2: "CC7.2, CC7.3" },
  { family: "CA", familyName: "Assessment, Authorization & Monitoring", cmmc: "CA", iso27001: "A.5.35, A.5.36, A.8.34", soc2: "CC4.1, CC4.2" },
  { family: "CM", familyName: "Configuration Management", cmmc: "CM", iso27001: "A.8.9, A.8.32", soc2: "CC8.1" },
  { family: "CP", familyName: "Contingency Planning", cmmc: "—", iso27001: "A.5.29, A.5.30, A.8.13, A.8.14", soc2: "A1.2, A1.3" },
  { family: "IA", familyName: "Identification & Authentication", cmmc: "IA", iso27001: "A.5.16, A.5.17, A.8.5", soc2: "CC6.1" },
  { family: "IR", familyName: "Incident Response", cmmc: "IR", iso27001: "A.5.24–A.5.28", soc2: "CC7.3, CC7.4, CC7.5" },
  { family: "MA", familyName: "Maintenance", cmmc: "MA", iso27001: "A.7.13, A.8.32", soc2: "CC8.1" },
  { family: "MP", familyName: "Media Protection", cmmc: "MP", iso27001: "A.7.10, A.7.14, A.8.10", soc2: "CC6.5, CC6.7" },
  { family: "PE", familyName: "Physical & Environmental Protection", cmmc: "PE", iso27001: "A.7.1–A.7.4", soc2: "CC6.4" },
  { family: "PL", familyName: "Planning", cmmc: "—", iso27001: "A.5.1–A.5.4", soc2: "CC1.1, CC1.2, CC1.3" },
  { family: "PS", familyName: "Personnel Security", cmmc: "PS", iso27001: "A.6.1–A.6.6", soc2: "CC1.4" },
  { family: "RA", familyName: "Risk Assessment", cmmc: "RA", iso27001: "A.5.7, A.8.8", soc2: "CC3.1–CC3.4" },
  { family: "SA", familyName: "System & Services Acquisition", cmmc: "—", iso27001: "A.5.19–A.5.21, A.8.25–A.8.30", soc2: "CC8.1" },
  { family: "SC", familyName: "System & Communications Protection", cmmc: "SC", iso27001: "A.8.20–A.8.24", soc2: "CC6.6, CC6.7" },
  { family: "SI", familyName: "System & Information Integrity", cmmc: "SI", iso27001: "A.8.7, A.8.8, A.8.16", soc2: "CC7.1, CC7.2" },
];

export const CROSSWALK_FRAMEWORKS = [
  { key: "cmmc", label: "CMMC 2.0 (L2)" },
  { key: "iso27001", label: "ISO/IEC 27001:2022" },
  { key: "soc2", label: "SOC 2 (TSC)" },
] as const;

// Derive the 800-53 family code from a control id, e.g. "AC-2" -> "AC", "SC-7(4)" -> "SC".
export function familyOf(controlId: string): string {
  const m = controlId.match(/^([A-Z]{2})-/);
  return m ? m[1] : controlId;
}

export type EquivalentRef = { framework: "ISO_27001" | "SOC2" | "CMMC"; ref: string };

// Informational cross-references for a NIST 800-53 control. The crosswalk is family-level and
// directional (NIST -> others), so these are surfaced in the UI as "mapped/inherited" hints —
// NOT an authoritative one-to-one satisfaction. Returns [] for control ids outside the 800-53
// scheme (e.g. commercial-catalog controls), where no reverse mapping is asserted.
export function equivalentControls(framework: string, controlId: string): EquivalentRef[] {
  if (framework !== "NIST_800_53") return [];
  const row = CROSSWALKS.find((r) => r.family === familyOf(controlId));
  if (!row) return [];
  const refs: EquivalentRef[] = [];
  if (row.iso27001 && row.iso27001 !== "—") refs.push({ framework: "ISO_27001", ref: row.iso27001 });
  if (row.soc2 && row.soc2 !== "—") refs.push({ framework: "SOC2", ref: row.soc2 });
  if (row.cmmc && row.cmmc !== "—") refs.push({ framework: "CMMC", ref: row.cmmc });
  return refs;
}
