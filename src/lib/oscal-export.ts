// OSCAL export builders. Produces structurally-OSCAL JSON (NIST OSCAL 1.1.x shapes) for a
// System Security Plan and for Assessment Results / SAR. Pure functions — unit tested.
// IDs use deterministic UUID-shaped values derived from record ids so exports are reproducible.

type OscalJson = Record<string, unknown>;

// OSCAL control ids are lowercase, dotted (e.g. "AC-2" -> "ac-2", "AC-2(1)" -> "ac-2.1").
export function toOscalControlId(controlId: string): string {
  return controlId
    .toLowerCase()
    .replace(/\((\w+)\)/g, ".$1")
    .replace(/\s+/g, "");
}

// Deterministic, UUID-shaped identifier from an arbitrary key (not a real UUID, but stable +
// well-formed for OSCAL consumers that only require the uuid pattern).
export function stableUuid(key: string): string {
  let h = 0x811c9dc5;
  const bytes: number[] = [];
  for (let i = 0; i < 32; i++) {
    h ^= key.charCodeAt(i % key.length) + i * 31;
    h = Math.imul(h, 0x01000193) >>> 0;
    bytes.push(h & 0xff);
  }
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function metadata(title: string, now: string): OscalJson {
  return {
    title,
    "last-modified": now,
    version: "1.0.0",
    "oscal-version": "1.1.2",
  };
}

export type SspInput = {
  systemId: string;
  systemName: string;
  description: string;
  fipsCategory: string; // LOW | MODERATE | HIGH
  controls: { controlId: string; status: string; scoping: string; narrative: string; providerName: string }[];
};

const FIPS_TO_LEVEL: Record<string, string> = { LOW: "fips-199-low", MODERATE: "fips-199-moderate", HIGH: "fips-199-high" };

export function buildOscalSsp(input: SspInput, now = new Date().toISOString()): OscalJson {
  const level = FIPS_TO_LEVEL[input.fipsCategory] ?? "fips-199-moderate";
  const applicable = input.controls.filter((c) => c.scoping !== "NOT_APPLICABLE");

  return {
    "system-security-plan": {
      uuid: stableUuid(`ssp:${input.systemId}`),
      metadata: metadata(`System Security Plan — ${input.systemName}`, now),
      "import-profile": { href: "#nist-800-53-rev5-moderate" },
      "system-characteristics": {
        "system-name": input.systemName,
        description: input.description || input.systemName,
        "security-sensitivity-level": level,
        "system-information": {
          "information-types": [
            { uuid: stableUuid(`info:${input.systemId}`), title: "System information", description: input.description || input.systemName },
          ],
        },
        status: { state: "operational" },
      },
      "system-implementation": {
        users: [],
        components: [],
      },
      "control-implementation": {
        description: `Control implementation for ${input.systemName}.`,
        "implemented-requirements": applicable.map((c) => ({
          uuid: stableUuid(`ir:${input.systemId}:${c.controlId}`),
          "control-id": toOscalControlId(c.controlId),
          props: [
            { name: "implementation-status", ns: "https://csrc.nist.gov/ns/oscal", value: c.status.toLowerCase() },
            ...(c.scoping === "INHERITED" || c.scoping === "HYBRID"
              ? [{ name: "control-origination", value: c.scoping.toLowerCase(), class: c.providerName || "external-provider" }]
              : []),
          ],
          statements: [
            {
              "statement-id": `${toOscalControlId(c.controlId)}_smt`,
              uuid: stableUuid(`smt:${input.systemId}:${c.controlId}`),
              "by-components": [
                {
                  "component-uuid": stableUuid(`comp:${input.systemId}`),
                  uuid: stableUuid(`bc:${input.systemId}:${c.controlId}`),
                  description: c.narrative || "Implementation statement not yet documented.",
                },
              ],
            },
          ],
        })),
      },
    },
  };
}

const RESULT_TO_OSCAL: Record<string, string> = {
  SATISFIED: "satisfied",
  OTHER_THAN_SATISFIED: "not-satisfied",
  NOT_APPLICABLE: "not-applicable",
  NOT_ASSESSED: "not-assessed",
};

export type AssessmentInput = {
  assessmentId: string;
  title: string;
  systemName: string;
  assessorName: string;
  startedAt: string;
  completedAt: string | null;
  results: { controlId: string; result: string; findings: string; recommendation: string }[];
};

export function buildOscalAssessmentResults(input: AssessmentInput, now = new Date().toISOString()): OscalJson {
  const findings = input.results
    .filter((r) => r.result === "OTHER_THAN_SATISFIED")
    .map((r) => ({
      uuid: stableUuid(`finding:${input.assessmentId}:${r.controlId}`),
      title: `${r.controlId} — other than satisfied`,
      description: r.findings || `Control ${r.controlId} was assessed as other than satisfied.`,
      ...(r.recommendation ? { remarks: r.recommendation } : {}),
    }));

  return {
    "assessment-results": {
      uuid: stableUuid(`ar:${input.assessmentId}`),
      metadata: metadata(`Security Assessment Results — ${input.systemName}`, now),
      "import-ap": { href: `#assessment-plan-${input.assessmentId}` },
      results: [
        {
          uuid: stableUuid(`result:${input.assessmentId}`),
          title: input.title,
          description: `Security control assessment of ${input.systemName} by ${input.assessorName || "the assessment team"}.`,
          start: input.startedAt,
          ...(input.completedAt ? { end: input.completedAt } : {}),
          "reviewed-controls": {
            "control-selections": [
              {
                "include-controls": input.results.map((r) => ({ "control-id": toOscalControlId(r.controlId) })),
              },
            ],
          },
          "local-definitions": {
            props: input.results.map((r) => ({
              name: "assessment-result",
              class: toOscalControlId(r.controlId),
              value: RESULT_TO_OSCAL[r.result] ?? "not-assessed",
            })),
          },
          findings,
        },
      ],
    },
  };
}
