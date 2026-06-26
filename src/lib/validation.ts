import { z } from "zod";

// Password policy: 10+ chars with at least one letter and one number. (Pure zod — safe to import
// from client code; hashing lives in lib/password.ts.)
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    message: "Password must include at least one letter and one number",
  });

export const ROLES = ["ADMIN", "ATO_SME", "ISSO", "VULN_ANALYST", "SYSTEM_OWNER", "EXECUTIVE"] as const;

export const userCreateSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  role: z.enum(ROLES),
});

export const userUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  resetMfa: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ token: z.string().min(10), password: passwordSchema });

export const mfaEnableSchema = z.object({ token: z.string().min(6).max(10) });
export const mfaDisableSchema = z.object({ password: z.string().min(1) });

export const FIPS = ["LOW", "MODERATE", "HIGH"] as const;
export const FRAMEWORKS = [
  "NIST_RMF",
  "NIST_800_53",
  "NIST_800_37",
  "FISMA",
  "FEDRAMP_READY",
  "SOC2",
  "HIPAA",
  "ISO_27001",
  "ISO_42001",
] as const;

export const systemCreateSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().default(""),
  fipsCategory: z.enum(FIPS).default("MODERATE"),
  frameworks: z.array(z.enum(FRAMEWORKS)).min(1),
  ownerId: z.string().optional().nullable(),
});

export const implementationUpdateSchema = z.object({
  scoping: z
    .enum(["APPLICABLE", "NOT_APPLICABLE", "INHERITED", "HYBRID", "COMPENSATING"])
    .optional(),
  status: z
    .enum([
      "NOT_IMPLEMENTED",
      "PLANNED",
      "PARTIALLY_IMPLEMENTED",
      "IMPLEMENTED",
      "RISK_ACCEPTED",
    ])
    .optional(),
  narrative: z.string().max(20000).optional(),
  ownerId: z.string().nullable().optional(),
});

export const evidenceCreateSchema = z.object({
  systemId: z.string(),
  title: z.string().min(2).max(200),
  type: z.string().max(60).default("Document"),
  url: z.string().max(2000).optional().default(""),
  note: z.string().max(4000).optional().default(""),
  implementationIds: z.array(z.string()).optional().default([]),
});

export const evidenceLinkSchema = z.object({
  implementationIds: z.array(z.string()),
});

export const rmfUpdateSchema = z.object({
  step: z.enum([
    "PREPARE",
    "CATEGORIZE",
    "SELECT",
    "IMPLEMENT",
    "ASSESS",
    "AUTHORIZE",
    "MONITOR",
  ]),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"])
    .optional(),
  ownerId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).optional(),
});

export const SEVERITY = ["INFO", "LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export const POAM_STATUS = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "COMPLETED",
  "RISK_ACCEPTED",
  "CLOSED",
] as const;

export const poamCreateSchema = z.object({
  systemId: z.string(),
  weaknessTitle: z.string().min(2).max(200),
  weaknessDescription: z.string().max(8000).optional().default(""),
  source: z.string().max(60).default("Manual"),
  severity: z.enum(SEVERITY).default("MODERATE"),
  riskRating: z.enum(SEVERITY).default("MODERATE"),
  cvss: z.number().min(0).max(10).nullable().optional(),
  remediationPlan: z.string().max(8000).optional().default(""),
  residualRisk: z.string().max(4000).optional().default(""),
  scheduledCompletion: z.string().datetime().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  implementationId: z.string().nullable().optional(),
});

export const poamUpdateSchema = poamCreateSchema
  .partial()
  .omit({ systemId: true })
  .extend({
    status: z.enum(POAM_STATUS).optional(),
    statusNote: z.string().max(2000).optional(),
  });

export const RISK_LEVEL = ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
export const RISK_STATUS = ["OPEN", "MITIGATING", "ACCEPTED", "CLOSED"] as const;

export const riskCreateSchema = z.object({
  systemId: z.string(),
  title: z.string().min(2).max(200),
  description: z.string().max(8000).optional().default(""),
  threat: z.string().max(2000).optional().default(""),
  vulnerabilityNarrative: z.string().max(2000).optional().default(""),
  likelihood: z.enum(RISK_LEVEL).default("MODERATE"),
  impact: z.enum(RISK_LEVEL).default("MODERATE"),
  residualLikelihood: z.enum(RISK_LEVEL).default("MODERATE"),
  residualImpact: z.enum(RISK_LEVEL).default("MODERATE"),
  mitigationPlan: z.string().max(8000).optional().default(""),
  targetDate: z.string().datetime().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  relatedControl: z.string().nullable().optional(),
  relatedPoamId: z.string().nullable().optional(),
  relatedVulnId: z.string().nullable().optional(),
});

export const riskUpdateSchema = riskCreateSchema
  .partial()
  .omit({ systemId: true })
  .extend({
    status: z.enum(RISK_STATUS).optional(),
    acceptanceDecision: z.string().max(4000).optional(),
    approvalAuthority: z.string().max(200).optional(),
  });

export const ppsmCreateSchema = z.object({
  systemId: z.string(),
  port: z.string().min(1).max(20),
  protocol: z.enum(["TCP", "UDP", "ICMP", "OTHER"]).default("TCP"),
  service: z.string().min(1).max(120),
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("INBOUND"),
  source: z.string().max(200).optional().default(""),
  destination: z.string().max(200).optional().default(""),
  justification: z.string().max(2000).optional().default(""),
  status: z.enum(["APPROVED", "PENDING", "DENIED"]).default("PENDING"),
  associatedControl: z.string().max(20).nullable().optional(),
});

export const ppsmUpdateSchema = ppsmCreateSchema.partial().omit({ systemId: true });

export const POLICY_STATUS = ["DRAFT", "UNDER_REVIEW", "APPROVED", "EXPIRED"] as const;

export const policyCreateSchema = z.object({
  title: z.string().min(2).max(200),
  framework: z.enum(FRAMEWORKS).default("NIST_RMF"),
  version: z.string().max(20).optional().default("1.0"),
  status: z.enum(POLICY_STATUS).default("DRAFT"),
  body: z.string().max(20000).optional().default(""),
  url: z.string().max(2000).optional().default(""),
  ownerId: z.string().nullable().optional(),
  reviewDate: z.string().datetime().nullable().optional(),
});

export const policyUpdateSchema = policyCreateSchema.partial();

export const aiDraftSchema = z.object({
  kind: z.enum(["control_narrative", "poam_description", "executive_summary"]),
  systemId: z.string(),
  implementationId: z.string().optional(),
  poamId: z.string().optional(),
});
