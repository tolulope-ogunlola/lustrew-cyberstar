# Security Policy

Lustrew CyberStar is a cybersecurity compliance platform, so we take the security of the project
itself seriously.

## Reporting a vulnerability

**Please do not open public issues for security vulnerabilities.**

Report privately via **GitHub Security Advisories** ("Report a vulnerability" on the Security tab)
or email **security@lustrewdynamics.com**. Include reproduction steps, affected version/commit, and
impact. We aim to acknowledge within 3 business days and to provide a remediation timeline after triage.

## Supported versions

This is pre-1.0 software. Security fixes target the latest `main` and the most recent tagged release.

## Built-in protections

- Role-based access control on every API route; per-organization tenant isolation
  (covered by `npm run test:integration`).
- Authentication via NextAuth with bcrypt password hashing, a password policy, optional TOTP MFA,
  failed-login rate limiting, and 8-hour sessions.
- Encryption at rest for integration credentials (AES-256-GCM, `src/lib/crypto.ts`).
- Per-request **nonce-based Content-Security-Policy** plus HSTS, `X-Frame-Options`,
  `X-Content-Type-Options`, Referrer-Policy, and Permissions-Policy.
- Upload defenses: size cap, content-type allowlist, **magic-byte sniffing**, and a malware-scan
  hook; evidence is served only through authenticated, org-scoped downloads.
- Output safety: CSV/formula-injection neutralization in exports; React-escaped rendering;
  append-only audit log.

## Known limitations (pre-1.0)

These are documented rather than hidden; production deployers should review `DEPLOYMENT.md`:

- The bundled malware-scan hook detects the EICAR test signature only — wire a real engine
  (e.g. ClamAV) via `AV_DRIVER` for production.
- Rate limiting is in-memory per process by default — back it with Redis for multi-instance.
- The default mailer logs to console — configure SMTP/SES for real delivery.

Do not run the demo seed (default credentials) in any internet-facing environment.
