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

export const ROLES = ["ADMIN", "ATO_SME", "ISSO", "VULN_ANALYST", "SYSTEM_OWNER", "EXECUTIVE", "ASSESSOR"] as const;

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

export const PLAN_IDS = ["FREE", "PRO", "MSP", "ENTERPRISE"] as const;
export const organizationUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  plan: z.enum(PLAN_IDS).optional(),
  billingEmail: z.string().email().max(200).or(z.literal("")).optional(),
});

export const signupSchema = z.object({
  orgName: z.string().min(2, "Organization name is required").max(120),
  name: z.string().min(2, "Your name is required").max(120),
  email: z.string().email().max(200),
  password: passwordSchema,
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
  "NIST_800_171",
  "CMMC_L1",
  "CMMC_L2",
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
  providerName: z.string().max(200).optional(),
  ownerId: z.string().nullable().optional(),
});

export const EVIDENCE_APPROVAL_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
] as const;

export const evidenceCreateSchema = z.object({
  systemId: z.string(),
  title: z.string().min(2).max(200),
  type: z.string().max(60).default("Document"),
  url: z.string().max(2000).optional().default(""),
  note: z.string().max(4000).optional().default(""),
  implementationIds: z.array(z.string()).optional().default([]),
  validUntil: z.string().datetime().nullable().optional(),
  cadenceDays: z.number().int().min(0).max(3650).optional().default(0),
  collectedAt: z.string().datetime().nullable().optional(),
});

// Approval/transition action. Authors may submit; only approvers may review/approve/reject
// (enforced in the route via RBAC + canTransition).
export const evidenceStatusSchema = z.object({
  approvalStatus: z.enum(EVIDENCE_APPROVAL_STATUS),
  reviewNote: z.string().max(4000).optional(),
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

// --- Assessment & Authorization ---
export const ASSESSMENT_RESULTS = ["SATISFIED", "OTHER_THAN_SATISFIED", "NOT_APPLICABLE", "NOT_ASSESSED"] as const;
export const AUTHORIZATION_DECISIONS = ["ATO", "ATO_WITH_CONDITIONS", "IATT", "DENIED", "REVOKED"] as const;

export const assessmentCreateSchema = z.object({
  systemId: z.string(),
  title: z.string().min(2).max(200),
  assessorName: z.string().max(200).optional(),
});

export const assessmentUpdateSchema = z.object({
  status: z.enum(["DRAFT", "IN_PROGRESS", "COMPLETED"]).optional(),
  summary: z.string().max(8000).optional(),
  assessorName: z.string().max(200).optional(),
});

export const assessmentResultUpdateSchema = z.object({
  result: z.enum(ASSESSMENT_RESULTS).optional(),
  findings: z.string().max(8000).optional(),
  recommendation: z.string().max(8000).optional(),
});

// --- CMMC / 800-171 asset inventory ---
export const ASSET_CATEGORIES = ["CUI", "SECURITY_PROTECTION", "CONTRACTOR_RISK_MANAGED", "SPECIALIZED", "OUT_OF_SCOPE"] as const;
export const ASSET_TYPES = ["Server", "Workstation", "Network", "Cloud Service", "Application", "Mobile", "Other"] as const;

export const assetCreateSchema = z.object({
  systemId: z.string(),
  name: z.string().min(1).max(200),
  assetType: z.enum(ASSET_TYPES).optional(),
  category: z.enum(ASSET_CATEGORIES).optional(),
  description: z.string().max(2000).optional(),
  owner: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
});

export const authorizationCreateSchema = z.object({
  systemId: z.string(),
  decision: z.enum(AUTHORIZATION_DECISIONS),
  authorizingOfficial: z.string().min(2).max(200),
  decisionDate: z.string().optional(), // ISO date; defaults to now
  expiresAt: z.string().optional(),
  rationale: z.string().max(8000).optional(),
  conditions: z.string().max(8000).optional(),
});

export const aiChatSchema = z.object({
  systemId: z.string(),
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(20)
    .optional(),
});

export const aiGapSchema = z.object({ systemId: z.string() });

export const aiDocSchema = z.object({
  systemId: z.string(),
  kind: z.enum(["ssp", "sar"]),
});

export const aiPolicyAnalysisSchema = z.object({
  systemId: z.string(),
  text: z.string().min(20, "Paste at least a paragraph of policy text").max(50000),
});

// --- Assessor: request-more-evidence workflow ---
export const evidenceRequestCreateSchema = z.object({
  systemId: z.string(),
  controlId: z.string().min(1).max(40),
  note: z.string().max(4000).optional(),
});

export const evidenceRequestResolveSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]),
  response: z.string().max(4000).optional(),
});

// --- Vendor / third-party risk ---
export const DATA_SENSITIVITY = ["NONE", "PUBLIC", "INTERNAL", "CONFIDENTIAL", "PII", "PHI", "CUI"] as const;
export const VENDOR_CRITICALITY = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
export const VENDOR_STATUS = ["PROSPECTIVE", "ACTIVE", "UNDER_REVIEW", "OFFBOARDING", "TERMINATED"] as const;
export const REVIEW_CADENCE = ["NONE", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "BIENNIAL"] as const;
export const VENDOR_RISK_RATING = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const VENDOR_REVIEW_STATUS = ["NOT_STARTED", "QUESTIONNAIRE_SENT", "QUESTIONNAIRE_RECEIVED", "IN_REVIEW", "COMPLETED", "OVERDUE"] as const;
export const VENDOR_DOC_TYPE = ["SOC2_TYPE2", "SOC2_TYPE1", "ISO_27001", "PENTEST", "DPA", "BAA", "CONTRACT", "QUESTIONNAIRE", "OTHER"] as const;

export const vendorCreateSchema = z.object({
  name: z.string().min(2).max(200),
  businessPurpose: z.string().max(4000).optional().default(""),
  dataSensitivity: z.enum(DATA_SENSITIVITY).default("NONE"),
  criticality: z.enum(VENDOR_CRITICALITY).default("MODERATE"),
  status: z.enum(VENDOR_STATUS).default("PROSPECTIVE"),
  reviewCadence: z.enum(REVIEW_CADENCE).default("ANNUAL"),
  riskRating: z.enum(VENDOR_RISK_RATING).optional(),
  nextReviewDate: z.string().datetime().nullable().optional(),
  renewalDate: z.string().datetime().nullable().optional(),
  contactName: z.string().max(200).optional().default(""),
  contactEmail: z.string().email().max(200).or(z.literal("")).optional().default(""),
  website: z.string().max(2000).optional().default(""),
  hasDpa: z.boolean().optional().default(false),
  dpaExpiresAt: z.string().datetime().nullable().optional(),
  ownerId: z.string().nullable().optional(),
});
export const vendorUpdateSchema = vendorCreateSchema.partial();

export const vendorReviewCreateSchema = z.object({
  reviewType: z.enum(["ONBOARDING", "PERIODIC", "INCIDENT", "RENEWAL"]).default("PERIODIC"),
  dueDate: z.string().datetime().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
});
export const vendorReviewUpdateSchema = z.object({
  status: z.enum(VENDOR_REVIEW_STATUS).optional(),
  questionnaireSentAt: z.string().datetime().nullable().optional(),
  questionnaireReceivedAt: z.string().datetime().nullable().optional(),
  findings: z.string().max(8000).optional(),
  mitigationPlan: z.string().max(8000).optional(),
  residualRiskRating: z.enum(VENDOR_RISK_RATING).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
});
export const vendorDocumentCreateSchema = z.object({
  docType: z.enum(VENDOR_DOC_TYPE).default("OTHER"),
  title: z.string().min(2).max(200),
  url: z.string().max(2000).optional().default(""),
  validUntil: z.string().datetime().nullable().optional(),
  note: z.string().max(4000).optional().default(""),
  evidenceId: z.string().nullable().optional(),
});

// --- Personnel compliance ---
export const PERSONNEL_TYPE = ["EMPLOYEE", "CONTRACTOR", "INTERN", "SERVICE_ACCOUNT"] as const;
export const PERSONNEL_STATUS = ["ONBOARDING", "ACTIVE", "OFFBOARDING", "OFFBOARDED"] as const;
export const BG_CHECK_STATUS = ["NOT_STARTED", "PENDING", "CLEARED", "FAILED", "EXEMPT"] as const;
export const TRAINING_STATUS = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "WAIVED"] as const;
export const ACCESS_REVIEW_STATUS = ["PENDING", "IN_PROGRESS", "CERTIFIED", "REVOKED", "OVERDUE"] as const;
export const ONBOARD_PHASE = ["ONBOARDING", "OFFBOARDING"] as const;

export const personnelCreateSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(200).or(z.literal("")).optional().default(""),
  personnelType: z.enum(PERSONNEL_TYPE).default("EMPLOYEE"),
  department: z.string().max(120).optional().default(""),
  jobTitle: z.string().max(120).optional().default(""),
  status: z.enum(PERSONNEL_STATUS).default("ACTIVE"),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  bgCheckStatus: z.enum(BG_CHECK_STATUS).default("NOT_STARTED"),
  bgCheckDate: z.string().datetime().nullable().optional(),
  deviceAssignment: z.string().max(200).optional().default(""),
  userId: z.string().nullable().optional(),
});
export const personnelUpdateSchema = personnelCreateSchema.partial();

export const trainingCourseCreateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional().default(""),
  cadenceDays: z.number().int().min(0).max(3650).optional().default(365),
  active: z.boolean().optional().default(true),
});
export const trainingCourseUpdateSchema = trainingCourseCreateSchema.partial();

export const trainingAssignmentCreateSchema = z.object({
  courseId: z.string(),
  dueDate: z.string().datetime().nullable().optional(),
});
export const trainingAssignmentUpdateSchema = z.object({
  status: z.enum(TRAINING_STATUS).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  certificateEvidenceId: z.string().nullable().optional(),
});

export const accessReviewCreateSchema = z.object({
  scope: z.string().max(200).optional().default(""),
  dueDate: z.string().datetime().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
});
export const accessReviewUpdateSchema = z.object({
  status: z.enum(ACCESS_REVIEW_STATUS).optional(),
  decision: z.string().max(40).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
  notes: z.string().max(4000).optional(),
});

export const onboardingTaskCreateSchema = z.object({
  phase: z.enum(ONBOARD_PHASE).default("ONBOARDING"),
  title: z.string().min(2).max(200),
  dueDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional().default(0),
});
export const onboardingTaskUpdateSchema = z.object({
  done: z.boolean().optional(),
  title: z.string().min(2).max(200).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

// --- Continuous controls monitoring (CCM) ---
export const checkAssignSchema = z.object({
  systemId: z.string(),
  checkId: z.string(),
  integrationId: z.string().nullable().optional(),
  enabled: z.boolean().optional().default(true),
  params: z.record(z.unknown()).optional().default({}),
});
export const checkAssignUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  integrationId: z.string().nullable().optional(),
  params: z.record(z.unknown()).optional(),
});

// --- Trust Center ---
export const TRUST_DOC_CATEGORY = ["SOC2", "ISO_CERT", "PENTEST", "POLICY", "OTHER"] as const;
export const TRUST_DOC_VISIBILITY = ["PUBLIC", "GATED"] as const;

export const trustCenterUpdateSchema = z.object({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only").optional(),
  published: z.boolean().optional(),
  companyName: z.string().max(200).optional(),
  headline: z.string().max(300).optional(),
  overview: z.string().max(20000).optional(),
  frameworks: z.array(z.string().max(40)).optional(),
  subprocessors: z.array(z.object({ name: z.string().max(120), purpose: z.string().max(200), location: z.string().max(120) })).optional(),
  statusUrl: z.string().max(2000).optional(),
  contactEmail: z.string().email().max(200).or(z.literal("")).optional(),
});
export const trustDocumentSchema = z.object({
  title: z.string().min(2).max(200),
  category: z.enum(TRUST_DOC_CATEGORY).default("OTHER"),
  visibility: z.enum(TRUST_DOC_VISIBILITY).default("GATED"),
  evidenceId: z.string().nullable().optional(),
  url: z.string().max(2000).optional().default(""),
  requiresNda: z.boolean().optional().default(true),
});
export const accessRequestPublicSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional().default(""),
  company: z.string().max(200).optional().default(""),
  reason: z.string().max(2000).optional().default(""),
  requestedDocs: z.array(z.string()).min(1, "Select at least one document"),
});
export const ndaAcceptSchema = z.object({
  accessRequestId: z.string(),
  acceptedName: z.string().min(2).max(200),
  ndaVersion: z.string().max(20),
});
export const accessDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "DENY"]),
  expiresInDays: z.number().int().min(1).max(90).optional().default(7),
});

// --- Questionnaire automation ---
export const ANSWER_STATUS = ["DRAFT", "APPROVED", "RETIRED"] as const;
export const QUESTIONNAIRE_ITEM_STATUS = ["PENDING", "DRAFTED", "APPROVED", "NEEDS_INPUT"] as const;

export const answerLibrarySchema = z.object({
  question: z.string().min(3).max(2000),
  answer: z.string().min(1).max(8000),
  category: z.string().max(80).optional().default("General"),
  tags: z.array(z.string().max(40)).optional().default([]),
  status: z.enum(ANSWER_STATUS).optional().default("APPROVED"),
});
export const answerLibraryUpdateSchema = answerLibrarySchema.partial();

export const questionnaireCreateSchema = z.object({
  name: z.string().min(2).max(200),
  customer: z.string().max(200).optional().default(""),
});
export const questionnaireItemUpdateSchema = z.object({
  approvedAnswer: z.string().max(8000).optional(),
  draftAnswer: z.string().max(8000).optional(),
  status: z.enum(QUESTIONNAIRE_ITEM_STATUS).optional(),
});

// --- External auditor engagements ---
export const ENGAGEMENT_SCOPES = ["controls", "evidence", "policies", "poams", "risks", "audit"] as const;

export const auditEngagementCreateSchema = z.object({
  systemId: z.string(),
  auditorEmail: z.string().email().max(200),
  auditorName: z.string().min(2).max(200),
  scopes: z.array(z.enum(ENGAGEMENT_SCOPES)).min(1),
  expiresInDays: z.number().int().min(1).max(365).optional().default(30),
  title: z.string().max(200).optional().default(""),
});
export const auditEngagementUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "REVOKED"]).optional(),
  scopes: z.array(z.enum(ENGAGEMENT_SCOPES)).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
