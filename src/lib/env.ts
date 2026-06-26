import { z } from "zod";

// Validated, typed server environment. Import `serverEnv` from server-only code.
// Parsing is lazy (on first access) so a production misconfiguration fails fast at runtime
// with a clear message, without breaking the build.

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET must be at least 16 characters"),
  NEXTAUTH_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().optional().default("claude-opus-4-8"),
  STORAGE_DRIVER: z.enum(["local"]).optional().default("local"),
  STORAGE_DIR: z.string().optional().default(".data/uploads"),
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Non-throwing snapshot of which optional capabilities are configured (for /api/health). */
export function envStatus() {
  return {
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    storageDriver: process.env.STORAGE_DRIVER || "local",
    nodeEnv: process.env.NODE_ENV || "development",
  };
}
