# Lustrew CyberStar — Production Deployment Runbook

This guide takes CyberStar from local SQLite dev to a hardened PostgreSQL production deployment.

## 1. Prerequisites

- Node.js 22+
- A PostgreSQL 14+ database (managed service recommended; use a **pooled** connection string for
  serverless/edge hosting)
- Object storage for evidence (S3/Azure Blob) for multi-host deployments — local disk is
  single-host only
- TLS termination in front of the app (load balancer or platform)

## 2. Switch the database provider to PostgreSQL

The schema is provider-agnostic (no enums / array columns / `Json` / `@db.Text`), so the cutover
is one line:

```bash
npm run db:provider:postgres      # rewrites the datasource provider to "postgresql"
```

Set `DATABASE_URL` to your Postgres URL, then author and apply migrations:

```bash
# First time (authors prisma/migrations from the current schema; needs a reachable Postgres):
npm run db:migrate:dev -- --name init

# In the deploy pipeline (idempotent, no prompts):
npm run db:migrate                # = prisma migrate deploy
```

> Local dev stays on SQLite: `npm run db:provider:sqlite && npm run db:push && npm run db:seed`.
> Commit the generated `prisma/migrations/` once you cut over so `migrate deploy` is reproducible.

## 3. Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string (pooled for serverless) |
| `NEXTAUTH_SECRET` | ✅ | 32+ char random (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | ✅ | Public HTTPS origin |
| `ANTHROPIC_API_KEY` | — | Enables real Claude drafting (else templated stub) |
| `MAILER_DRIVER` | — | `console` (default) — implement SMTP/SES for real delivery |
| `STORAGE_DRIVER` / `STORAGE_DIR` | — | Local disk; implement S3 driver for multi-host |
| `CRON_SECRET` | — | Enables the notifications scheduler endpoint |
| `AV_DRIVER` | — | `builtin` (EICAR check); wire ClamAV/cloud-AV for real scanning |
| `RATE_LIMIT_DRIVER` | — | In-memory by default; implement Redis for multi-instance |
| `LOG_LEVEL` | — | `info` in prod by default |

Env is validated at runtime by `src/lib/env.ts` — a missing required var fails fast.

## 4. Build & run

```bash
npm ci
npm run build
npm start                          # behind TLS, port 3000
```

Seed an initial admin (or run the standard seed in non-prod). Then log in and use
**Users → Invite** to onboard the team.

## 5. Scheduled jobs

Continuous-monitoring notifications recompute on demand; for unattended monitoring schedule:

```bash
curl -X POST https://<host>/api/notifications/run -H "x-cron-secret: $CRON_SECRET"   # hourly
```

## 6. Load the full control catalog (optional)

```bash
npm run db:import-oscal -- https://github.com/usnistgov/oscal-content/raw/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json
```

## 7. Health & observability

- `GET /api/health` — liveness/readiness (checks DB); wire to your load balancer.
- Every API response carries `x-request-id`; logs are structured JSON lines — forward to your
  aggregator (CloudWatch/Loki/Datadog). Point an error monitor (e.g. Sentry) at the `api.error` logs.

## 8. Security checklist (already enforced in code)

- Strict CSP + HSTS + frame/MIME headers (`next.config.ts`)
- 8h sessions; failed-login rate limiting; bcrypt password hashing; password policy
- Optional TOTP MFA; admin-managed accounts (invite/deactivate/reset)
- RBAC on every API route; org tenant isolation (covered by `npm run test:integration`)
- Upload malware scan + content-type allowlist + size cap; authenticated, org-scoped downloads
- Append-only audit log

### Before go-live

- [ ] Provision Postgres + run `migrate deploy`; configure automated backups + PITR
- [ ] Move evidence storage and rate limiting to S3 + Redis if running multiple instances
- [ ] Implement a real mailer (SMTP/SES) and AV scanner (ClamAV) driver
- [ ] Set `NEXTAUTH_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY`
- [ ] Run `npm run typecheck && npm test && npm run test:integration && npm run build` in CI (already wired)
- [ ] Configure error monitoring + log aggregation + uptime checks on `/api/health`
