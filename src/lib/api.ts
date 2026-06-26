import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "./auth";
import { can, type Action, type Entity } from "./rbac";
import { logger } from "./logger";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Resolve the session user or throw 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

/** Resolve the user and enforce an RBAC permission, or throw 401/403. */
export async function requirePermission(
  action: Action,
  entity: Entity
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, action, entity)) {
    throw new HttpError(403, `Role ${user.role} cannot ${action} ${entity}`);
  }
  return user;
}

/**
 * Wrap a route handler so thrown HttpErrors and validation errors become JSON responses.
 * Every response carries an `x-request-id`; each request is logged with its outcome + duration.
 */
export function route<T>(handler: () => Promise<T>) {
  const requestId = randomUUID();
  const start = Date.now();
  const headers = { "x-request-id": requestId };
  return (async () => {
    try {
      const data = await handler();
      logger.info("api.request", { requestId, status: 200, ms: Date.now() - start });
      return NextResponse.json(data, { headers });
    } catch (err) {
      const ms = Date.now() - start;
      if (err instanceof HttpError) {
        logger.warn("api.request", { requestId, status: err.status, ms, error: err.message });
        return NextResponse.json({ error: err.message, requestId }, { status: err.status, headers });
      }
      const message = err instanceof Error ? err.message : "Unexpected error";
      logger.error("api.error", { requestId, status: 400, ms, error: message });
      return NextResponse.json({ error: message, requestId }, { status: 400, headers });
    }
  })();
}
