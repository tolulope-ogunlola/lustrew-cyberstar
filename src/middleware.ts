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
  "/reports",
  "/integrations",
  "/notifications",
  "/account",
  "/admin",
  "/audit",
];

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

  // Auth gate for protected page paths.
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
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
