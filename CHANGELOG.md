# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Public landing page, contextual Help side panel, first-run Welcome modal, and a data-aware
  "Getting started" checklist.
- Light/dark theme with a system-aware, persisted toggle (Govtech Blue palette).
- Tab hover tooltips across the system workspace.
- Encryption at rest for integration credentials (AES-256-GCM).
- Per-request nonce-based Content-Security-Policy.
- Upload magic-byte content sniffing in addition to the malware-scan hook.
- Modal/drawer keyboard focus-trapping.
- Open-source scaffolding: LICENSE (Apache-2.0), SECURITY, CONTRIBUTING, Code of Conduct,
  issue/PR templates; hardened CI (lint, audit, Postgres job, CodeQL, gitleaks, E2E).
- Playwright end-to-end smoke tests.

### Fixed
- Help panel rendered as a clipped strip inside the blurred topbar (now portaled to `body`).
- CSV/formula injection in report and eMASS exports.
- Open redirect via the login `callbackUrl` parameter.

## [0.1.0] — Initial reference implementation

- Core compliance platform: auth + RBAC, systems, NIST 800-53 controls, RMF tracker, evidence
  vault, POA&M manager, vulnerability + STIG import, risk register, PPSM, policies, continuous-
  monitoring dashboard + notifications, reports (PDF/XLSX/CSV), integrations framework, AI
  drafting, and an append-only audit log.
