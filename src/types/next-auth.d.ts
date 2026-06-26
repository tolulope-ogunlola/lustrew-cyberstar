import type { Role } from "@/lib/types";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      orgId: string;
    };
  }
  interface User {
    role: Role;
    orgId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: Role;
    orgId: string;
  }
}
