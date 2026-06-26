// Parser for NIST OSCAL catalogs (e.g. the official SP 800-53 Rev 5 catalog JSON). Maps the
// nested OSCAL group/control/enhancement structure to flat control rows for the catalog table.
// Pure — unit tested in oscal.test.ts.

export type OscalControlRow = {
  controlId: string;
  family: string;
  title: string;
  text: string;
  baseline: string;
};

type Json = Record<string, unknown>;

function arr<T = Json>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function labelOf(control: Json): string {
  const props = arr<Json>(control.props);
  const label = props.find((p) => p.name === "label")?.value;
  return (typeof label === "string" && label) || String(control.id ?? "").toUpperCase();
}

// Recursively collect prose from the "statement" part (and its sub-parts).
function statementText(control: Json): string {
  const parts = arr<Json>(control.parts);
  const statement = parts.find((p) => p.name === "statement");
  if (!statement) return "";
  const out: string[] = [];
  const walk = (part: Json) => {
    if (typeof part.prose === "string" && part.prose.trim()) out.push(part.prose.trim());
    for (const sub of arr<Json>(part.parts)) walk(sub);
  };
  walk(statement);
  return out.join(" ");
}

function familyFromId(controlId: string, groupFamily: string): string {
  if (groupFamily) return groupFamily;
  const m = controlId.match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : "";
}

export function parseOscalCatalog(doc: unknown): OscalControlRow[] {
  const catalog = (doc as Json)?.catalog as Json | undefined;
  if (!catalog) throw new Error("Not an OSCAL catalog (missing top-level 'catalog')");

  const rows: OscalControlRow[] = [];

  const addControl = (control: Json, family: string) => {
    const controlId = labelOf(control);
    if (controlId) {
      rows.push({
        controlId,
        family: familyFromId(controlId, family),
        title: String(control.title ?? "Untitled"),
        text: statementText(control) || String(control.title ?? ""),
        baseline: "MODERATE",
      });
    }
    // Control enhancements are nested under control.controls.
    for (const sub of arr<Json>(control.controls)) addControl(sub, family);
  };

  const walkGroup = (group: Json) => {
    const family = String(group.id ?? "").toUpperCase();
    for (const control of arr<Json>(group.controls)) addControl(control, family);
    for (const sub of arr<Json>(group.groups)) walkGroup(sub);
  };

  for (const group of arr<Json>(catalog.groups)) walkGroup(group);
  // Some catalogs put controls directly on the catalog too.
  for (const control of arr<Json>(catalog.controls)) addControl(control, "");

  return rows;
}
