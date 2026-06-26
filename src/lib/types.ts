// String-union types mirroring the values stored in the (enum-less) SQLite schema.
// These replace the Prisma-generated enums and keep call sites type-safe.

export type Role =
  | "ADMIN"
  | "ATO_SME"
  | "ISSO"
  | "VULN_ANALYST"
  | "SYSTEM_OWNER"
  | "EXECUTIVE"
  | "ASSESSOR";

export type ImplementationStatus =
  | "NOT_IMPLEMENTED"
  | "PLANNED"
  | "PARTIALLY_IMPLEMENTED"
  | "IMPLEMENTED"
  | "RISK_ACCEPTED";

export type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE";

export type PoamStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "COMPLETED"
  | "RISK_ACCEPTED"
  | "CLOSED";
