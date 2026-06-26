# Architecture

A concise tour of how Lustrew CyberStar is built. For setup see the [README](../README.md);
for production see [DEPLOYMENT.md](../DEPLOYMENT.md).

## Overview

CyberStar is a single **Next.js 15 (App Router)** application — UI and API in one deployable —
backed by **Prisma** over **SQLite** (local dev) or **PostgreSQL** (production). The schema is
provider-agnostic, so the cutover is one command (`npm run db:provider:postgres`).

```
                          Browser (React Server + Client Components, Tailwind)
                                            │
                              middleware.ts │  nonce CSP + security headers
                                            │  auth gate (getToken) for protected paths
                                            ▼
   ┌──────────────────────────── Next.js App Router ────────────────────────────┐
   │  app/(app)/*  authenticated pages         app/api/*  route handlers          │
   │  app/page.tsx public landing              ── requireUser / requirePermission │
   │  app/login,forgot,reset  auth             ── route() wrapper: req-id + logs  │
   └───────────────────────────────┬──────────────────────────────┬─────────────┘
                                    │                              │
                         src/lib/* domain logic            NextAuth (JWT sessions)
            (scoring, risk, vuln/stig parsers, reports,     credentials + bcrypt + TOTP
             notifications rules, integrations, crypto)            │
                                    │                              │
                                    ▼                              ▼
                              Prisma Client ───────────────► SQLite / PostgreSQL
                                    │
              StorageProvider (evidence files)   Mailer (invites/resets)   AV scan hook
              local disk / S3*                    console / SMTP*           EICAR / ClamAV*
                                                                            (* = drop-in for prod)
```

## Request lifecycle

1. **middleware.ts** runs on every non-asset path: generates a per-request **nonce**, sets a strict
   `Content-Security-Policy` (+ HSTS et al. via `next.config.ts`), and redirects unauthenticated
   users away from protected page prefixes (via `getToken`).
2. **Page** (server component) reads the session with `currentUser()` and renders; client components
   fetch data from `/api/*` with the `useApi` hook.
3. **API route** is wrapped by `route()` ([src/lib/api.ts](../src/lib/api.ts)) which assigns an
   `x-request-id`, logs the outcome + duration ([src/lib/logger.ts](../src/lib/logger.ts)), and maps
   thrown `HttpError`s to JSON. Handlers call `requireUser()` / `requirePermission(action, entity)`
   and scope every query by `orgId`.

## Authentication & authorization

- **NextAuth** credentials provider, JWT sessions (8h). Passwords are bcrypt-hashed with a policy;
  optional **TOTP MFA**; failed logins are rate-limited (`src/lib/rateLimit.ts`, Redis-ready).
- **RBAC** is centralized in [src/lib/rbac.ts](../src/lib/rbac.ts): a `can(role, action, entity)`
  matrix plus the role→navigation map. Six roles (Admin, ATO/A&A SME, ISSO, Vulnerability Analyst,
  System Owner, Executive).
- **Tenant isolation**: every record hangs off an `Organization`; queries filter by `orgId` (directly
  or through the `system` relation). Proven by [tests/integration/tenant-isolation.test.ts](../tests/integration/tenant-isolation.test.ts).

## Data model (Prisma)

`Organization → User`, `Organization → System`. Each **System** owns its compliance objects:
`ControlImplementation` (against a global `Control` catalog), `RmfStep`, `Evidence` (↔ controls via
`EvidenceLink`), `Vulnerability`, `StigFinding`, `Poam` (+ `PoamMilestone`, `PoamStatusHistory`),
`Risk`, `PpsmEntry`, `ScanImport`. Org-level: `Policy` (+ `PolicyAck`), `Integration`,
`Notification`, `AuditEvent` (append-only). The schema avoids DB-specific enums/arrays so it runs on
both SQLite and Postgres; string-union types live in [src/lib/types.ts](../src/lib/types.ts).

## Domain logic (`src/lib`)

Pure, unit-tested modules keep business rules out of routes/UI:

- **scoring.ts** — ATO readiness + control posture.
- **risk.ts** — 5×5 likelihood × impact scoring (inherent/residual).
- **vuln/** — `parse` (Nessus `.nessus` + ACAS/CSV), `prioritize` (CVSS + control mapping + SLA),
  `ingest` (dedupe + upsert) shared by file import and scanner connectors.
- **stig/parse.ts** — DISA `.ckl` parser + CAT mapping.
- **notifications/** — `rules` (overdue/at-risk detection) + `run` (idempotent upsert + auto-resolve).
- **report/** — gatherers + PDF (pdfkit) / XLSX (exceljs) / CSV formatters (with injection guards).
- **integrations/** — `registry`, `scanners` (Tenable/Qualys), `servicenow`, `emass`, `mask`
  (encrypt/decrypt/mask config). Connectors implement a small interface; mock mode enables trials.
- **crypto.ts** — AES-256-GCM for secrets at rest. **av.ts** — malware + magic-byte checks.
  **storage.ts** — pluggable evidence storage. **mailer.ts** — pluggable email.

## Frontend

- App shell: `Sidebar` (role-filtered nav) + `Topbar` (breadcrumb, notifications bell, theme
  toggle, Info → contextual `HelpPanel`).
- **Theming**: `ink`/`slate`/`brand` Tailwind scales are CSS variables swapped between `:root`
  (light) and `.dark` (dark); a no-FOUC inline script + `ThemeToggle` persist the choice.
- Shared primitives in [src/components/ui.tsx](../src/components/ui.tsx); overlays use
  `useFocusTrap` for accessibility.

## Testing

| Layer | Where | Runs |
| --- | --- | --- |
| Unit | `src/**/*.test.ts` (Vitest) | `npm test` |
| Integration (tenant isolation) | `tests/integration` | `npm run test:integration` (SQLite + Postgres in CI) |
| E2E | `tests/e2e` (Playwright) | `npm run test:e2e` |

CI (`.github/workflows/`) runs typecheck, lint, `npm audit`, all three test layers, a build,
**CodeQL**, and **gitleaks**.

## Security layers (summary)

RBAC + tenant isolation · nonce CSP + HSTS/frame/MIME headers · encrypted secrets at rest ·
upload size/type allowlist + magic-byte sniffing + malware-scan hook · authenticated org-scoped
downloads · CSV-injection-safe exports · append-only audit log. See [SECURITY.md](../SECURITY.md).
