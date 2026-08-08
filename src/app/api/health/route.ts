import { NextResponse } from "next/server";
import { hasDatabaseConfig } from "@/lib/db/database-env";
import { prisma } from "@/lib/db/prisma";

/**
 * Liveness + database readiness.
 *
 * This endpoint used to report `healthy` whenever `hasDatabaseConfig()` was
 * true — which only asks whether the environment variables EXIST, never
 * whether the database answers. On 2026-08-08 production served
 * `{"status":"healthy"}` while every query failed with Prisma P1001
 * ("Can't reach database server"), because DATABASE_URL was present but
 * malformed. A health check that goes green while the app is unusable is
 * worse than no health check, so this one issues a real query.
 */

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  database: {
    configured: boolean;
    reachable: boolean;
    /** Error CLASS only — never the message, which can carry the DSN. */
    error?: string;
  };
  verification_system: {
    enabled: boolean;
    independent_verification: boolean;
    self_attestation_blocked: boolean;
  };
}

const startTime = Date.now();

/** A hung database must not hang the health check that reports on it. */
const DB_PROBE_TIMEOUT_MS = 5_000;

/** Distinguishes our own timeout from a driver failure without parsing messages. */
class ProbeTimeoutError extends Error {
  constructor() {
    super("probe timeout");
    this.name = "ProbeTimeoutError";
  }
}

/**
 * Shapes safe to echo from a PUBLIC, UNAUTHENTICATED endpoint.
 *
 * ALLOW-LIST, deliberately, not a deny-list. An earlier revision returned
 * `error.code` verbatim whenever it was a non-empty string, assuming only the
 * message could carry secrets. That is false — nothing stops a driver, adapter
 * or proxy putting connection-string material in `code` or `name`, and review
 * demonstrated it by throwing `{ code: 'postgresql://postgres:...@host/db' }`
 * and reading the DSN straight out of this endpoint's JSON.
 */
const SAFE_CODE_PATTERNS = [
  /^P\d{4}$/, // Prisma, e.g. P1001
  /^[0-9A-Z]{5}$/, // SQLSTATE, e.g. 08006
  /^E[A-Z]{2,15}$/, // Node syscall, e.g. ECONNREFUSED
];

/** Error class names: letters only, so no DSN punctuation can survive. */
const SAFE_NAME_PATTERN = /^[A-Za-z]{1,64}$/;

/**
 * Identify the failure without leaking it. Anything not matching a known-safe
 * shape collapses to a fixed token — an unrecognised value is dropped, never
 * passed through.
 */
function describeFailure(error: unknown): string {
  if (error instanceof ProbeTimeoutError) return "ProbeTimeout";

  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && SAFE_CODE_PATTERNS.some((pattern) => pattern.test(code))) {
      return code;
    }
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && SAFE_NAME_PATTERN.test(name)) {
      return name;
    }
  }
  return "UnknownError";
}

async function probeDatabase(): Promise<HealthResponse["database"]> {
  if (!hasDatabaseConfig()) {
    return { configured: false, reachable: false, error: "NotConfigured" };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new ProbeTimeoutError()), DB_PROBE_TIMEOUT_MS);
    });
    // Cheapest round trip that proves the connection is live, not merely configured.
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return { configured: true, reachable: true };
  } catch (error) {
    return { configured: true, reachable: false, error: describeFailure(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const database = await probeDatabase();

  const body: HealthResponse = {
    status: database.reachable ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    environment: process.env.NODE_ENV || "development",
    database,
    verification_system: {
      enabled: true,
      independent_verification: true,
      self_attestation_blocked: true,
    },
  };

  return NextResponse.json(body, { status: database.reachable ? 200 : 503 });
}

// A cached health check reports the past, not the present.
export const dynamic = "force-dynamic";
export const revalidate = 0;
