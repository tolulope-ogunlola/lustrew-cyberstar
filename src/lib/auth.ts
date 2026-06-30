import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Role } from "./types";
import { prisma } from "./db";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "./rateLimit";
import { verifyPassword } from "./password";
import { verifyTotp } from "./totp";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8h absolute session lifetime
    updateAge: 60 * 60, // refresh the token at most hourly
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totp: { label: "Authenticator code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.toLowerCase();
        // Throttle brute-force by email + client IP.
        const ip =
          (req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
          "unknown";
        const key = `${email}|${ip}`;
        if (isLoginBlocked(key)) {
          throw new Error("Too many failed attempts. Try again in a few minutes.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) {
          recordLoginFailure(key);
          return null;
        }
        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) {
          recordLoginFailure(key);
          return null;
        }
        // Second factor: when MFA is enabled, a valid TOTP code is required.
        if (user.mfaEnabled) {
          if (!verifyTotp(credentials.totp ?? "", user.mfaSecret ?? "")) {
            recordLoginFailure(key);
            throw new Error("MFA code required");
          }
        }
        clearLoginFailures(key);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          orgId: user.orgId,
          isExternal: user.isExternal,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.orgId = (user as { orgId: string }).orgId;
        token.uid = (user as { id: string }).id;
        token.isExternal = (user as { isExternal?: boolean }).isExternal ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as Role;
        session.user.orgId = token.orgId as string;
        (session.user as { isExternal?: boolean }).isExternal = (token.isExternal as boolean) ?? false;
      }
      return session;
    },
  },
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  isExternal?: boolean;
};

/** Server-side helper: returns the typed session user, or null if not signed in. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}
