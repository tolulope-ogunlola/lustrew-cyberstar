# Contributing to Lustrew CyberStar

Thanks for your interest in improving CyberStar! This guide gets you productive quickly.

## Development setup

```bash
npm install
npm run db:push       # creates the local SQLite DB
npm run db:seed       # demo org, users, and sample data
npm run dev           # http://localhost:3000
```

Demo login: `sme@cyberstar.gov` / `Password123!` (see the README for all roles).

## Before you open a PR

Run the full local gate — CI runs the same:

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # vitest unit tests
npm run test:integration # tenant-isolation tests on a throwaway SQLite DB
npm run build            # production build
```

> Windows + OneDrive note: stop the dev server before `npm run build`, and `rm -rf .next` before
> switching back to `npm run dev` (a Next/OneDrive `readlink` quirk).

## Guidelines

- **TypeScript strict** — no `any` escape hatches without justification.
- **Every API route** must enforce auth + RBAC and be **org-scoped** (`where: { …, orgId }` or via
  the system relation). Add/adjust an integration test if you touch data access.
- **Pure logic** (scoring, parsing, prioritization, mapping) goes in `src/lib/**` with a unit test.
- **Secrets** never enter the repo, logs, or API responses. Use `src/lib/crypto.ts` for at-rest
  secrets and the masking helpers for connector config.
- **UI** uses the shared theme tokens (`ink`/`slate`/`brand` scales) so light/dark both work;
  prefer the existing components in `src/components`.
- Conventional, present-tense commit messages (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).

## Reporting bugs / requesting features

Use the issue templates. For **security** issues, follow `SECURITY.md` (do not open a public issue).

## License

By contributing, you agree your contributions are licensed under the project's Apache-2.0 license.
