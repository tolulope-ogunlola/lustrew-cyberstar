// SQLite has no array columns, so System.frameworks is stored as a JSON string.
// These helpers serialize/deserialize at the API boundary so the client still sees string[].

export function serializeFrameworks(frameworks: string[]): string {
  return JSON.stringify(frameworks);
}

export function parseFrameworks(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Reshape a system row so `frameworks` is an array for the client. */
export function withFrameworks<T extends { frameworks: string }>(
  system: T
): Omit<T, "frameworks"> & { frameworks: string[] } {
  return { ...system, frameworks: parseFrameworks(system.frameworks) };
}
