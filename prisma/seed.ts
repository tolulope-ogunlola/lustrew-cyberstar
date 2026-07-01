import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recordSnapshots } from "@/lib/metrics/snapshot";
import { deriveResultFromStatus } from "@/lib/assessment";

const prisma = new PrismaClient();

// Role is a plain string column (SQLite has no enums).
type Role = "ADMIN" | "ATO_SME" | "ISSO" | "VULN_ANALYST" | "SYSTEM_OWNER" | "EXECUTIVE" | "ASSESSOR";

type ControlSeed = {
  controlId: string;
  family: string;
  title: string;
  baseline: string;
  text: string;
};

const DEMO_PASSWORD = "Password123!";

const DEMO_USERS: { email: string; name: string; role: Role }[] = [
  { email: "admin@cyberstar.gov", name: "Avery Admin", role: "ADMIN" },
  { email: "sme@cyberstar.gov", name: "Sam SME", role: "ATO_SME" },
  { email: "isso@cyberstar.gov", name: "Ivy ISSO", role: "ISSO" },
  { email: "vuln@cyberstar.gov", name: "Vic Vuln", role: "VULN_ANALYST" },
  { email: "owner@cyberstar.gov", name: "Owen Owner", role: "SYSTEM_OWNER" },
  { email: "exec@cyberstar.gov", name: "Erin Exec", role: "EXECUTIVE" },
  { email: "assessor@cyberstar.gov", name: "Alex Assessor", role: "ASSESSOR" },
];

const RMF_STEPS = [
  "PREPARE",
  "CATEGORIZE",
  "SELECT",
  "IMPLEMENT",
  "ASSESS",
  "AUTHORIZE",
  "MONITOR",
] as const;

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Seeding Lustrew CyberStar…");

  // Clean slate (dev seed).
  await prisma.auditEvent.deleteMany();
  await prisma.poamStatusHistory.deleteMany();
  await prisma.poamMilestone.deleteMany();
  await prisma.poam.deleteMany();
  await prisma.evidenceLink.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.rmfStep.deleteMany();
  await prisma.controlImplementation.deleteMany();
  await prisma.system.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.control.deleteMany();
  await prisma.evidenceRequirement.deleteMany();
  await prisma.check.deleteMany();

  // --- Organization + users ---
  const org = await prisma.organization.create({
    data: { name: "Lustrew Dynamics", plan: "MSP", billingEmail: "billing@lustrewdynamics.com" },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<Role, string> = {} as Record<Role, string>;
  for (const u of DEMO_USERS) {
    const created = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        orgId: org.id,
      },
    });
    users[u.role] = created.id;
  }

  // --- Control catalogs (NIST 800-53 + NIST 800-171) ---
  const controls: ControlSeed[] = JSON.parse(
    readFileSync(join(__dirname, "data", "nist-800-53-controls.json"), "utf8")
  );
  await prisma.control.createMany({
    data: controls.map((c) => ({
      controlId: c.controlId,
      family: c.family,
      title: c.title,
      text: c.text,
      baseline: c.baseline,
      framework: "NIST_800_53",
    })),
  });
  const controls171: { controlId: string; family: string; title: string; text: string }[] = JSON.parse(
    readFileSync(join(__dirname, "data", "nist-800-171.json"), "utf8")
  );
  await prisma.control.createMany({
    data: controls171.map((c) => ({
      controlId: c.controlId,
      family: c.family,
      title: c.title,
      text: c.text,
      baseline: "MODERATE",
      framework: "NIST_800_171",
    })),
  });
  // --- Commercial framework catalogs (SOC 2, ISO 27001, HIPAA, ISO 42001) ---
  const COMMERCIAL_PACKS: { file: string; framework: string }[] = [
    { file: "soc2-tsc.json", framework: "SOC2" },
    { file: "iso-27001-2022.json", framework: "ISO_27001" },
    { file: "hipaa-security-rule.json", framework: "HIPAA" },
    { file: "iso-42001.json", framework: "ISO_42001" },
  ];
  for (const pack of COMMERCIAL_PACKS) {
    const rows: ControlSeed[] = JSON.parse(readFileSync(join(__dirname, "data", pack.file), "utf8"));
    await prisma.control.createMany({
      data: rows.map((c) => ({
        controlId: c.controlId,
        family: c.family,
        title: c.title,
        text: c.text,
        baseline: c.baseline,
        framework: pack.framework,
      })),
    });
  }

  // --- Per-control evidence requirements (Vanta-style "each control maps to required evidence") ---
  type EvidenceReqSeed = {
    framework: string;
    controlId: string;
    key: string;
    title: string;
    description?: string;
    evidenceType?: string;
    cadence?: string;
    automatable?: boolean;
    checkKey?: string;
  };
  const evidenceReqs: EvidenceReqSeed[] = JSON.parse(
    readFileSync(join(__dirname, "data", "evidence-requirements.json"), "utf8")
  );
  await prisma.evidenceRequirement.createMany({
    data: evidenceReqs.map((r) => ({
      framework: r.framework,
      controlId: r.controlId,
      key: r.key,
      title: r.title,
      description: r.description ?? "",
      evidenceType: r.evidenceType ?? "Document",
      cadence: r.cadence ?? "ANNUAL",
      automatable: r.automatable ?? false,
      checkKey: r.checkKey ?? null,
    })),
  });

  // --- CCM check catalog ---
  type CheckSeed = {
    key: string; title: string; category: string; providerType: string; probe: string;
    severity: string; frequency: string; remediation: string; evidenceType: string;
    mappedControls: { framework: string; controlId: string }[];
  };
  const checkSeeds: CheckSeed[] = JSON.parse(readFileSync(join(__dirname, "data", "checks.json"), "utf8"));
  await prisma.check.createMany({
    data: checkSeeds.map((c) => ({
      key: c.key, title: c.title, category: c.category, providerType: c.providerType, probe: c.probe,
      severity: c.severity, frequency: c.frequency, remediation: c.remediation, evidenceType: c.evidenceType,
      mappedControls: JSON.stringify(c.mappedControls),
    })),
  });

  // 800-53 controls drive the RMF/53 demo systems below.
  const allControls = await prisma.control.findMany({ where: { framework: "NIST_800_53" } });

  // --- Two systems with differing maturity ---
  const statuses = [
    "IMPLEMENTED",
    "IMPLEMENTED",
    "PARTIALLY_IMPLEMENTED",
    "PLANNED",
    "NOT_IMPLEMENTED",
  ] as const;

  async function buildSystem(opts: {
    name: string;
    description: string;
    fips: "LOW" | "MODERATE" | "HIGH";
    frameworks: string[];
    maturityOffset: number; // shifts the status mix
  }) {
    const system = await prisma.system.create({
      data: {
        name: opts.name,
        description: opts.description,
        fipsCategory: opts.fips,
        frameworks: JSON.stringify(opts.frameworks),
        orgId: org.id,
        ownerId: users.SYSTEM_OWNER,
      },
    });

    // Control implementations with a deterministic spread of statuses.
    const impls = [];
    for (let i = 0; i < allControls.length; i++) {
      const c = allControls[i];
      const status = statuses[(i + opts.maturityOffset) % statuses.length];
      const scoping = i % 11 === 0 ? "INHERITED" : i % 17 === 0 ? "NOT_APPLICABLE" : "APPLICABLE";
      const impl = await prisma.controlImplementation.create({
        data: {
          systemId: system.id,
          controlId: c.id,
          status,
          scoping,
          ownerId: i % 2 === 0 ? users.ISSO : users.SYSTEM_OWNER,
          narrative:
            status === "IMPLEMENTED"
              ? `${c.controlId} is implemented for ${system.name} and validated during the most recent assessment cycle.`
              : "",
        },
      });
      impls.push({ impl, control: c, status });
    }

    // Evidence linked to a handful of implemented controls.
    const implemented = impls.filter((x) => x.status === "IMPLEMENTED").slice(0, 6);
    for (const { impl, control } of implemented) {
      const ev = await prisma.evidence.create({
        data: {
          systemId: system.id,
          title: `${control.controlId} evidence — ${control.title}`,
          type: control.family === "AU" ? "Scan" : "Policy",
          url: `https://evidence.local/${system.name.replace(/\s+/g, "-").toLowerCase()}/${control.controlId}.pdf`,
          note: "Captured during continuous monitoring cycle.",
          uploadedById: users.ISSO,
          approvalStatus: "APPROVED",
          collectedAt: daysFromNow(-30),
          cadenceDays: 365,
          validUntil: daysFromNow(335),
          reviewedAt: daysFromNow(-28),
          reviewerId: users.ATO_SME,
        },
      });
      await prisma.evidenceLink.create({
        data: { evidenceId: ev.id, implementationId: impl.id },
      });
    }

    // RMF steps: earlier steps complete, later ones in progress / not started.
    for (let s = 0; s < RMF_STEPS.length; s++) {
      const progress = s + opts.maturityOffset;
      const status =
        progress < 3 ? "COMPLETE" : progress === 3 ? "IN_PROGRESS" : progress === 4 ? "BLOCKED" : "NOT_STARTED";
      await prisma.rmfStep.create({
        data: {
          systemId: system.id,
          step: RMF_STEPS[s],
          status,
          ownerId: users.ATO_SME,
          dueDate: daysFromNow((s - 1) * 14),
        },
      });
    }

    // A few POA&Ms, including an overdue one.
    const partials = impls.filter((x) => x.status === "PARTIALLY_IMPLEMENTED").slice(0, 3);
    let n = 1;
    for (const { impl, control } of partials) {
      const overdue = n === 1;
      const poam = await prisma.poam.create({
        data: {
          poamNumber: `POAM-${system.name.slice(0, 2).toUpperCase()}-${String(n).padStart(3, "0")}`,
          weaknessTitle: `${control.controlId} partially implemented`,
          weaknessDescription: `Control ${control.controlId} (${control.title}) is only partially implemented on ${system.name}.`,
          source: "ControlAssessment",
          severity: n === 1 ? "HIGH" : "MODERATE",
          riskRating: n === 1 ? "HIGH" : "MODERATE",
          status: n === 1 ? "IN_PROGRESS" : "OPEN",
          remediationPlan: "Complete the implementation and provide validating evidence.",
          residualRisk: "Moderate until remediation evidence is validated.",
          scheduledCompletion: overdue ? daysFromNow(-10) : daysFromNow(30 * n),
          systemId: system.id,
          ownerId: users.ISSO,
          implementationId: impl.id,
        },
      });
      await prisma.poamStatusHistory.create({
        data: { poamId: poam.id, status: poam.status, note: "POA&M created (seed)", changedBy: users.ISSO },
      });
      await prisma.poamMilestone.create({
        data: { poamId: poam.id, description: "Develop corrective action plan", dueDate: daysFromNow(7) },
      });
      await prisma.poamMilestone.create({
        data: { poamId: poam.id, description: "Implement and validate", dueDate: daysFromNow(21) },
      });
      n++;
    }

    // A few risks across the heatmap (one high/critical, one accepted).
    const riskSeeds = [
      {
        title: "Unpatched internet-facing service could allow remote compromise",
        threat: "External attacker",
        likelihood: "HIGH",
        impact: "VERY_HIGH",
        residualLikelihood: "MODERATE",
        residualImpact: "HIGH",
        status: "MITIGATING",
        relatedControl: "SI-2",
        mitigationPlan: "Accelerate patch cadence; add WAF in front of the service.",
      },
      {
        title: "Incomplete audit logging may hinder incident investigation",
        threat: "Insider / undetected activity",
        likelihood: "MODERATE",
        impact: "MODERATE",
        residualLikelihood: "LOW",
        residualImpact: "MODERATE",
        status: "OPEN",
        relatedControl: "AU-2",
        mitigationPlan: "Expand event logging coverage and centralize review.",
      },
      {
        title: "Legacy TLS configuration accepted pending decommission",
        threat: "Network interception",
        likelihood: "LOW",
        impact: "MODERATE",
        residualLikelihood: "LOW",
        residualImpact: "LOW",
        status: "ACCEPTED",
        relatedControl: "SC-8",
        mitigationPlan: "Service scheduled for decommission next quarter.",
        acceptanceDecision: "Residual risk accepted until decommission.",
        approvalAuthority: "AO — J. Authorizing Official",
      },
    ];
    let rn = 1;
    for (const rs of riskSeeds) {
      await prisma.risk.create({
        data: {
          riskNumber: `RISK-${system.name.slice(0, 2).toUpperCase()}-${String(rn).padStart(3, "0")}`,
          systemId: system.id,
          ownerId: users.ISSO,
          targetDate: daysFromNow(45),
          ...rs,
        },
      });
      rn++;
    }

    // PPSM register entries
    await prisma.ppsmEntry.createMany({
      data: [
        { systemId: system.id, port: "443", protocol: "TCP", service: "HTTPS", direction: "INBOUND", source: "Internet", destination: "Web tier", justification: "Public application access", status: "APPROVED", associatedControl: "SC-7" },
        { systemId: system.id, port: "5432", protocol: "TCP", service: "PostgreSQL", direction: "INBOUND", source: "App tier", destination: "DB tier", justification: "Application database access", status: "APPROVED", associatedControl: "SC-7" },
        { systemId: system.id, port: "22", protocol: "TCP", service: "SSH", direction: "INBOUND", source: "Admin VPN", destination: "All hosts", justification: "Administrative access", status: "PENDING", associatedControl: "AC-17" },
      ],
    });

    return system;
  }

  const atlas = await buildSystem({
    name: "Atlas Cloud Platform",
    description: "Primary multi-tenant SaaS platform pursuing a Moderate ATO.",
    fips: "MODERATE",
    frameworks: ["NIST_RMF", "NIST_800_53", "FISMA", "FEDRAMP_READY"],
    maturityOffset: 0,
  });
  const helix = await buildSystem({
    name: "Helix Data Exchange",
    description: "Inter-agency data exchange service in early authorization.",
    fips: "HIGH",
    frameworks: ["NIST_RMF", "NIST_800_53", "FISMA"],
    maturityOffset: 2,
  });
  const seededSystems = [atlas, helix];

  // --- 30 days of historical posture snapshots so dashboard trend charts render immediately ---
  // Today's row is the real computed posture; prior days trend gently upward toward it.
  await recordSnapshots(org.id);
  const clamp = (n: number) => Math.max(0, Math.round(n));
  for (const sys of seededSystems) {
    const today = await prisma.metricSnapshot.findUnique({
      where: { systemId_day: { systemId: sys.id, day: new Date().toISOString().slice(0, 10) } },
    });
    if (!today) continue;
    for (let d = 30; d >= 1; d--) {
      // ramp 0..1 from oldest (lower posture, more open items) to most recent.
      const t = (30 - d) / 30;
      const wobble = ((d * 7) % 5) - 2; // small deterministic noise
      const day = new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
      await prisma.metricSnapshot.upsert({
        where: { systemId_day: { systemId: sys.id, day } },
        update: {},
        create: {
          systemId: sys.id,
          orgId: org.id,
          day,
          readinessScore: clamp(today.readinessScore * (0.55 + 0.45 * t) + wobble),
          posturePercent: clamp(today.posturePercent * (0.55 + 0.45 * t) + wobble),
          rmfProgressPercent: clamp(today.rmfProgressPercent * (0.6 + 0.4 * t)),
          evidenceCompletePercent: clamp(today.evidenceCompletePercent * (0.5 + 0.5 * t)),
          openPoams: clamp(today.openPoams + (1 - t) * 6 + wobble),
          overduePoams: clamp(today.overduePoams + (1 - t) * 3),
          openVulnCritical: clamp(today.openVulnCritical + (1 - t) * 4),
          openVulnHigh: clamp(today.openVulnHigh + (1 - t) * 8 + wobble),
          openRisks: clamp(today.openRisks + (1 - t) * 5),
        },
      });
    }
  }

  // --- Assessment & Authorization demo data (Atlas) ---
  // Mark a couple of Atlas controls as inherited from a common control provider.
  const atlasImpls = await prisma.controlImplementation.findMany({
    where: { systemId: atlas.id, scoping: { not: "NOT_APPLICABLE" } },
    include: { control: { select: { controlId: true, title: true } } },
    orderBy: { control: { controlId: "asc" } },
  });
  for (const ci of atlasImpls.filter((i) => ["PE-1", "PE-2", "PE-3"].includes(i.control.controlId))) {
    await prisma.controlImplementation.update({ where: { id: ci.id }, data: { scoping: "INHERITED", providerName: "AWS GovCloud" } });
  }

  // A completed Security Control Assessment with results derived from implementation status.
  await prisma.assessment.create({
    data: {
      systemId: atlas.id,
      title: "Annual Security Control Assessment 2026",
      assessorName: "Independent Assessment Team",
      status: "COMPLETED",
      completedAt: new Date(),
      summary: "Independent assessment of applicable controls; most satisfied with a small number of other-than-satisfied findings.",
      results: {
        create: atlasImpls.map((i) => ({
          controlId: i.control.controlId,
          controlTitle: i.control.title,
          result: deriveResultFromStatus(i.status, i.scoping),
          findings:
            deriveResultFromStatus(i.status, i.scoping) === "OTHER_THAN_SATISFIED"
              ? `${i.control.controlId} implementation is incomplete or lacks sufficient evidence.`
              : "",
          recommendation:
            deriveResultFromStatus(i.status, i.scoping) === "OTHER_THAN_SATISFIED"
              ? "Complete the implementation and attach validating evidence; track as a POA&M if remediation is deferred."
              : "",
        })),
      },
    },
  });

  // An ATO-with-conditions authorization decision.
  await prisma.authorizationDecision.create({
    data: {
      systemId: atlas.id,
      decision: "ATO_WITH_CONDITIONS",
      authorizingOfficial: "Jordan Pierce, Authorizing Official",
      decisionDate: new Date(),
      expiresAt: daysFromNow(365),
      rationale: "Residual risk is acceptable given compensating controls and the active POA&M remediation plan.",
      conditions: "Close all overdue POA&Ms within 90 days; submit monthly continuous-monitoring reports.",
      signedById: users.ADMIN,
    },
  });

  // Assessor evidence requests against Atlas (one open, one resolved).
  await prisma.evidenceRequest.create({
    data: {
      systemId: atlas.id,
      controlId: "AU-6",
      note: "Please provide the audit-review SOP and a sample of the weekly log-review records.",
      status: "OPEN",
      requestedById: users.ASSESSOR,
    },
  });
  await prisma.evidenceRequest.create({
    data: {
      systemId: atlas.id,
      controlId: "AC-2",
      note: "Need the account-management procedure and evidence of quarterly access reviews.",
      status: "RESOLVED",
      response: "Uploaded AC-2 procedure and Q1 access-review attestation to the evidence vault.",
      resolvedAt: new Date(),
      requestedById: users.ASSESSOR,
    },
  });

  // Demo connectors (mock mode) targeting Atlas — click Sync to pull data into the platform.
  await prisma.integration.createMany({
    data: [
      { orgId: org.id, type: "TENABLE", name: "Tenable.io (demo)", systemId: atlas.id, config: JSON.stringify({ mock: true }) },
      { orgId: org.id, type: "SHAREPOINT", name: "SharePoint — ATO Library (demo)", systemId: atlas.id, config: JSON.stringify({ mock: true }) },
    ],
  });

  // --- CMMC Level 2 contractor enclave (NIST 800-171) ---
  const falcon = await prisma.system.create({
    data: {
      name: "Falcon Contractor Enclave",
      description: "CUI enclave for a DoD subcontractor pursuing CMMC Level 2.",
      fipsCategory: "MODERATE",
      frameworks: JSON.stringify(["CMMC_L2", "NIST_800_171"]),
      orgId: org.id,
      ownerId: users.SYSTEM_OWNER,
    },
  });
  await prisma.rmfStep.createMany({
    data: (["PREPARE", "CATEGORIZE", "SELECT", "IMPLEMENT", "ASSESS", "AUTHORIZE", "MONITOR"] as const).map((s) => ({ systemId: falcon.id, step: s })),
  });
  const controls171Rows = await prisma.control.findMany({ where: { framework: "NIST_800_171" }, orderBy: { controlId: "asc" } });
  await prisma.controlImplementation.createMany({
    data: controls171Rows.map((c, i) => ({
      systemId: falcon.id,
      controlId: c.id,
      // Deterministic spread: most implemented, some partial, some not implemented → SPRS < 110.
      status: i % 7 === 0 ? "NOT_IMPLEMENTED" : i % 5 === 0 ? "PARTIALLY_IMPLEMENTED" : "IMPLEMENTED",
      narrative: i % 7 === 0 ? "" : "Implemented via enclave baseline configuration and documented procedures.",
    })),
  });
  await prisma.asset.createMany({
    data: [
      { systemId: falcon.id, name: "CUI File Server", assetType: "Server", category: "CUI", owner: "IT Ops", location: "Enclave VLAN" },
      { systemId: falcon.id, name: "Engineering Workstations", assetType: "Workstation", category: "CUI", owner: "Engineering", location: "Enclave VLAN" },
      { systemId: falcon.id, name: "Microsoft GCC High (M365)", assetType: "Cloud Service", category: "CUI", owner: "IT Ops", location: "Azure GCC High" },
      { systemId: falcon.id, name: "SIEM / Log Collector", assetType: "Application", category: "SECURITY_PROTECTION", owner: "Security", location: "Enclave VLAN" },
      { systemId: falcon.id, name: "Managed Firewall", assetType: "Network", category: "SECURITY_PROTECTION", owner: "MSP", location: "Perimeter" },
      { systemId: falcon.id, name: "Corporate Wiki", assetType: "Application", category: "OUT_OF_SCOPE", owner: "IT Ops", location: "Corporate network" },
    ],
  });

  // --- Commercial SaaS system pursuing SOC 2 + ISO 27001 ---
  const aurora = await prisma.system.create({
    data: {
      name: "Aurora SaaS",
      description: "Commercial multi-tenant SaaS pursuing SOC 2 Type II and ISO/IEC 27001 certification.",
      fipsCategory: "MODERATE",
      frameworks: JSON.stringify(["SOC2", "ISO_27001"]),
      orgId: org.id,
      ownerId: users.SYSTEM_OWNER,
    },
  });
  await prisma.rmfStep.createMany({
    data: RMF_STEPS.map((s) => ({ systemId: aurora.id, step: s })),
  });
  const commercialControls = await prisma.control.findMany({
    where: { framework: { in: ["SOC2", "ISO_27001"] } },
    orderBy: { controlId: "asc" },
  });
  for (let i = 0; i < commercialControls.length; i++) {
    const c = commercialControls[i];
    // Deterministic spread so the fulfillment view shows a realistic mix.
    const status = statuses[i % statuses.length];
    const impl = await prisma.controlImplementation.create({
      data: {
        systemId: aurora.id,
        controlId: c.id,
        status,
        ownerId: i % 2 === 0 ? users.ISSO : users.SYSTEM_OWNER,
        narrative:
          status === "IMPLEMENTED"
            ? `${c.controlId} is implemented for Aurora SaaS and validated during the most recent review.`
            : "",
      },
    });
    // Attach evidence to a few implemented controls so "evidence collected" is non-empty.
    // Alternate approved vs. pending-review so the approval workflow + backlog alerts are visible.
    if (status === "IMPLEMENTED" && i % 4 === 0) {
      const pending = i % 8 === 0;
      const ev = await prisma.evidence.create({
        data: {
          systemId: aurora.id,
          title: `${c.controlId} evidence — ${c.title}`,
          type: "Document",
          note: "Collected during SOC 2 / ISO 27001 readiness.",
          uploadedById: users.ISSO,
          approvalStatus: pending ? "SUBMITTED" : "APPROVED",
          collectedAt: daysFromNow(-20),
          cadenceDays: 365,
          validUntil: pending ? null : daysFromNow(345),
          reviewedAt: pending ? null : daysFromNow(-18),
          reviewerId: pending ? null : users.ATO_SME,
          statusHistory: {
            create: { status: pending ? "SUBMITTED" : "APPROVED", note: "Seed.", changedBy: users.ISSO },
          },
        },
      });
      await prisma.evidenceLink.create({ data: { evidenceId: ev.id, implementationId: impl.id } });
    }
  }

  // --- CCM: mock integrations + check assignments on Aurora (visible PASS/FAIL on first run) ---
  const [ghIntegration, m365Integration, awsIntegration] = await Promise.all([
    prisma.integration.create({ data: { orgId: org.id, type: "GITHUB", name: "GitHub (demo)", systemId: aurora.id, config: JSON.stringify({ mock: true, org: "lustrew" }) } }),
    prisma.integration.create({ data: { orgId: org.id, type: "M365", name: "Microsoft 365 (demo)", systemId: aurora.id, config: JSON.stringify({ mock: true }) } }),
    prisma.integration.create({ data: { orgId: org.id, type: "AWS", name: "AWS (demo)", systemId: aurora.id, config: JSON.stringify({ mock: true }) } }),
  ]);
  const integByProvider: Record<string, string> = { GITHUB: ghIntegration.id, M365: m365Integration.id, AWS: awsIntegration.id };
  const seededChecks = await prisma.check.findMany();
  for (const c of seededChecks) {
    const integrationId = integByProvider[c.providerType];
    if (!integrationId) continue; // only wire GitHub/M365/AWS demo connectors
    await prisma.checkAssignment.create({
      data: { orgId: org.id, systemId: aurora.id, checkId: c.id, integrationId, paramsJson: JSON.stringify({ maxAdmins: 5 }) },
    });
  }

  // Org policy library
  await prisma.policy.createMany({
    data: [
      { orgId: org.id, title: "Access Control Policy", framework: "NIST_RMF", version: "2.1", status: "APPROVED", ownerId: users.ISSO, reviewDate: daysFromNow(120) },
      { orgId: org.id, title: "Incident Response Plan", framework: "NIST_RMF", version: "1.3", status: "APPROVED", ownerId: users.ATO_SME, reviewDate: daysFromNow(45) },
      { orgId: org.id, title: "Configuration Management Policy", framework: "NIST_800_53", version: "1.0", status: "UNDER_REVIEW", ownerId: users.ISSO, reviewDate: daysFromNow(15) },
      { orgId: org.id, title: "AI Governance Policy", framework: "ISO_42001", version: "0.9", status: "DRAFT", ownerId: users.ATO_SME, reviewDate: daysFromNow(30) },
    ],
  });

  // --- Vendors (third-party risk) ---
  await prisma.vendor.create({
    data: {
      orgId: org.id, vendorNumber: "VEND-0001", name: "Amazon Web Services", businessPurpose: "Cloud infrastructure (production hosting)",
      dataSensitivity: "CONFIDENTIAL", criticality: "CRITICAL", status: "ACTIVE", reviewCadence: "ANNUAL", riskRating: "HIGH",
      nextReviewDate: daysFromNow(40), hasDpa: true, dpaExpiresAt: daysFromNow(200), ownerId: users.ISSO,
      reviews: { create: { reviewType: "PERIODIC", status: "COMPLETED", completedAt: daysFromNow(-325), residualRiskRating: "MEDIUM", findings: "SOC 2 Type II reviewed; no exceptions." } },
      documents: { create: { docType: "SOC2_TYPE2", title: "AWS SOC 2 Type II Report 2025", validUntil: daysFromNow(120) } },
    },
  });
  await prisma.vendor.create({
    data: {
      orgId: org.id, vendorNumber: "VEND-0002", name: "Datadog", businessPurpose: "Observability and monitoring",
      dataSensitivity: "INTERNAL", criticality: "HIGH", status: "ACTIVE", reviewCadence: "ANNUAL", riskRating: "MEDIUM",
      nextReviewDate: daysFromNow(-10), hasDpa: true, dpaExpiresAt: daysFromNow(15), ownerId: users.ISSO,
    },
  });
  await prisma.vendor.create({
    data: {
      orgId: org.id, vendorNumber: "VEND-0003", name: "Acme Payroll", businessPurpose: "HR/payroll processing (PII)",
      dataSensitivity: "PII", criticality: "HIGH", status: "UNDER_REVIEW", reviewCadence: "ANNUAL", riskRating: "HIGH",
      nextReviewDate: daysFromNow(20), hasDpa: false, ownerId: users.ATO_SME,
      reviews: { create: { reviewType: "ONBOARDING", status: "QUESTIONNAIRE_SENT", questionnaireSentAt: daysFromNow(-5), dueDate: daysFromNow(20) } },
    },
  });

  // --- Training courses + personnel ---
  const secAwareness = await prisma.trainingCourse.create({ data: { orgId: org.id, name: "Security Awareness Training", cadenceDays: 365 } });
  await prisma.trainingCourse.create({ data: { orgId: org.id, name: "Secure SDLC for Engineers", cadenceDays: 365 } });

  const issoPerson = await prisma.personnel.create({
    data: {
      orgId: org.id, fullName: "Ivy ISSO", email: "isso@cyberstar.gov", personnelType: "EMPLOYEE", department: "Security",
      jobTitle: "Compliance Analyst", status: "ACTIVE", bgCheckStatus: "CLEARED", bgCheckDate: daysFromNow(-200), userId: users.ISSO,
    },
  });
  await prisma.trainingAssignment.create({ data: { personnelId: issoPerson.id, courseId: secAwareness.id, status: "COMPLETED", completedAt: daysFromNow(-30), dueDate: daysFromNow(-40) } });
  await prisma.accessReview.create({ data: { personnelId: issoPerson.id, scope: "Atlas Cloud Platform", status: "CERTIFIED", reviewedAt: daysFromNow(-15), decision: "RETAIN" } });

  const contractor = await prisma.personnel.create({
    data: {
      orgId: org.id, fullName: "Carl Contractor", email: "carl@contractor.example", personnelType: "CONTRACTOR", department: "Engineering",
      jobTitle: "DevOps Contractor", status: "ONBOARDING", bgCheckStatus: "PENDING", startDate: daysFromNow(-3),
    },
  });
  await prisma.trainingAssignment.create({ data: { personnelId: contractor.id, courseId: secAwareness.id, status: "OVERDUE", dueDate: daysFromNow(-5) } });
  await prisma.onboardingTask.createMany({
    data: [
      { personnelId: contractor.id, phase: "ONBOARDING", title: "Sign acceptable use policy", sortOrder: 1, dueDate: daysFromNow(-2) },
      { personnelId: contractor.id, phase: "ONBOARDING", title: "Provision least-privilege access", sortOrder: 2, dueDate: daysFromNow(2) },
      { personnelId: contractor.id, phase: "ONBOARDING", title: "Issue managed laptop", done: true, sortOrder: 3 },
    ],
  });
  await prisma.accessReview.create({ data: { personnelId: contractor.id, scope: "GitHub org", status: "PENDING", dueDate: daysFromNow(-1) } });

  // --- Trust Center (published demo) ---
  await prisma.organization.update({ where: { id: org.id }, data: { slug: "lustrew" } });
  const trustCenter = await prisma.trustCenter.create({
    data: {
      orgId: org.id, published: true, companyName: "Lustrew Dynamics",
      headline: "Security and compliance you can verify.",
      overview: "Lustrew Dynamics maintains a comprehensive security program aligned to SOC 2, ISO 27001, and NIST 800-53. We enforce MFA, least-privilege access, encryption in transit and at rest, continuous controls monitoring, and a formal incident response program.",
      frameworks: JSON.stringify(["SOC 2", "ISO 27001", "NIST 800-53"]),
      subprocessors: JSON.stringify([
        { name: "Amazon Web Services", purpose: "Cloud infrastructure", location: "United States" },
        { name: "Datadog", purpose: "Monitoring", location: "United States" },
      ]),
      statusUrl: "https://status.lustrewdynamics.com", contactEmail: "security@lustrewdynamics.com",
    },
  });
  await prisma.trustDocument.createMany({
    data: [
      { trustCenterId: trustCenter.id, orgId: org.id, title: "SOC 2 Type II Report", category: "SOC2", visibility: "GATED", requiresNda: true },
      { trustCenterId: trustCenter.id, orgId: org.id, title: "ISO 27001 Certificate", category: "ISO_CERT", visibility: "PUBLIC", requiresNda: false },
      { trustCenterId: trustCenter.id, orgId: org.id, title: "Penetration Test Summary 2026", category: "PENTEST", visibility: "GATED", requiresNda: true },
    ],
  });

  // --- Questionnaire answer library ---
  await prisma.answerLibraryEntry.createMany({
    data: [
      { orgId: org.id, question: "Do you enforce multi-factor authentication for all users?", answer: "Yes. MFA is enforced for all users via conditional access policies and is continuously monitored.", category: "Access Control" },
      { orgId: org.id, question: "Is data encrypted at rest and in transit?", answer: "Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.2+).", category: "Encryption" },
      { orgId: org.id, question: "Do you have an incident response plan?", answer: "Yes. We maintain a documented incident response plan that is reviewed at least annually and tested periodically.", category: "Incident Response" },
      { orgId: org.id, question: "How do you manage third-party/vendor risk?", answer: "We maintain a vendor inventory with risk ratings, conduct security reviews on a defined cadence, and track SOC 2/ISO evidence and DPAs.", category: "Vendor Management" },
      { orgId: org.id, question: "Do you perform background checks on employees?", answer: "Yes. Background checks are performed on personnel prior to access to sensitive systems, subject to applicable law.", category: "Personnel" },
      { orgId: org.id, question: "Are access reviews performed regularly?", answer: "Yes. User access reviews are performed at least quarterly and access is provisioned on a least-privilege basis.", category: "Access Control" },
    ],
  });

  // --- External auditor + scoped engagement on Atlas ---
  const externalAuditor = await prisma.user.create({
    data: {
      email: "auditor@external-firm.example", name: "Dana External", role: "ASSESSOR", isExternal: true,
      passwordHash, orgId: org.id,
    },
  });
  await prisma.auditEngagement.create({
    data: {
      orgId: org.id, systemId: atlas.id, auditorId: externalAuditor.id, invitedById: users.ADMIN,
      title: "FY26 SOC 2 examination", status: "ACTIVE",
      scopes: JSON.stringify(["controls", "evidence", "poams", "risks"]),
      expiresAt: daysFromNow(60),
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: users.ADMIN,
      action: "seed.complete",
      entityType: "organization",
      entityId: org.id,
      metadata: JSON.stringify({ systems: 3, controls: allControls.length + controls171Rows.length }),
    },
  });

  console.log(`Seed complete. Demo password for all users: ${DEMO_PASSWORD}`);
  console.log("Users:", DEMO_USERS.map((u) => u.email).join(", "));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
