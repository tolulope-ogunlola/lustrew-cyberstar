import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const isProd = process.env.NODE_ENV === "production";

// Page-path prefixes that require authentication (API routes enforce their own 401s).
const PROTECTED = [
  "/dashboard",
  "/systems",
  "/controls",
  "/evidence",
  "/vulnerabilities",
  "/stig",
  "/poams",
  "/risks",
  "/ppsm",
  "/policies",
  "/vendors",
  "/personnel",
  "/checks",
  "/questionnaires",
  "/reports",
  "/integrations",
  "/notifications",
  "/organization",
  "/account",
  "/admin",
  "/audit",
  "/auditor",
];

// External auditors are confined to the auditor portal (+ their own account page).
const EXTERNAL_ALLOWED = ["/auditor", "/account"];

// Public Trust Center profiles live at /trust/[slug]; only the admin page at exactly "/trust" is
// gated. These prefixes are served without auth (the public default), so they are checked first.
const PUBLIC_PREFIXES = ["/trust/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Per-request nonce for a strict, inline-free script CSP. 'unsafe-inline' is a fallback that
  // modern browsers ignore when a nonce + strict-dynamic is present.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'${isProd ? "" : " ws:"}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join("; ");

  // Auth gate for protected page paths. Public Trust Center profiles (/trust/<slug>) are exempt;
  // the admin page at exactly "/trust" still requires auth (handled by the "/trust" prefix below).
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtected =
    !isPublic && (pathname === "/trust" || PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/")));
  if (isProtected) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    // External auditors may only reach the auditor portal + their account page.
    if (token.isExternal && !EXTERNAL_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      const url = req.nextUrl.clone();
      url.pathname = "/auditor";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Pass the nonce + CSP on the request so Next applies the nonce to its own scripts and Server
  // Components can read it; also set CSP on the response.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  // Run on everything except static assets and image optimizer output.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
