// Client-safe NDA constants (no node:crypto), importable from the public Trust Center page.
// The hashing helpers live in nda.ts (server-only).

export const CURRENT_NDA_VERSION = "1.0";

export const NDA_TEXT = `MUTUAL NON-DISCLOSURE AGREEMENT (clickwrap)

By requesting access to confidential security documentation, you agree on behalf of yourself and
your organization that: (1) the materials provided are Confidential Information; (2) you will use
them solely to evaluate the security posture of the disclosing organization; (3) you will not
distribute, publish, or disclose them to any third party; (4) you will protect them with at least
reasonable care; and (5) access is time-limited and may be revoked at any time. This acceptance is
recorded with your name, email, timestamp, and a hash of this agreement text.`;
