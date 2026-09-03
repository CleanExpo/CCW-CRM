import { NextResponse } from "next/server";
import {
  classifyDatabaseHost,
  hasDatabaseConfig,
  type DatabaseHostClass,
} from "@/lib/db/database-env";
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
    /** Shape of the configured host — never the host itself. */
    host_class: DatabaseHostClass;
    /** Operator guidance for a failure whose cause the host shape gives away. */
    hint?: string;
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
 * The exact set of identifiers this PUBLIC, UNAUTHENTICATED endpoint may echo.
 *
 * Two earlier revisions of this function were wrong in the same direction, and
 * the second is the instructive one:
 *
 *   1. It returned `error.code` verbatim for any non-empty string. A DSN placed
 *      in `code` was disclosed in full.
 *   2. It then allowed anything MATCHING A SAFE SHAPE. That is still a
 *      pass-through: `code: 'TOKEN'` and `name: 'LettersOnlySecret'` both
 *      satisfy the patterns and were disclosed. Rejecting punctuation is not
 *      the same as recognising a value.
 *
 * So membership, not resemblance. An identifier is echoed only if it is one we
 * put on this list ourselves; everything else becomes `UnknownError`. The full
 * error is logged server-side, so nothing diagnostic is lost — it just stops
 * being world-readable.
 */
const PUBLIC_ERROR_IDENTIFIERS: ReadonlySet<string> = new Set([
  // Prisma connection/initialisation failures — the ones an operator acts on.
  "P1000", // authentication failed
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1003", // database does not exist
  "P1008", // operation timed out
  "P1010", // access denied for user
  "P1011", // error opening a TLS connection
  "P1017", // server closed the connection
  "P2024", // connection pool timeout
  // Node syscall failures surfaced by the driver.
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNRESET",
  "EHOSTUNREACH",
  "EPIPE",
  // Trusted error classes, when no code is present.
  "PrismaClientInitializationError",
  "PrismaClientKnownRequestError",
  "PrismaClientRustPanicError",
  "DriverAdapterError",
]);

/**
 * Identify the failure without leaking it. Unrecognised identifiers are
 * dropped, never passed through.
 */
function describeFailure(error: unknown): string {
  if (error instanceof ProbeTimeoutError) return "ProbeTimeout";

  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && PUBLIC_ERROR_IDENTIFIERS.has(code)) {
      return code;
    }
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && PUBLIC_ERROR_IDENTIFIERS.has(name)) {
      return name;
    }
  }
  return "UnknownError";
}

/**
 * A Supabase direct host has no IPv4 address and Vercel has no IPv6 egress, so
 * a probe against it times out every time. Say so, rather than leaving the
 * operator to guess between "paused", "wrong project" and "unroutable".
 */
const SUPABASE_DIRECT_HOST_HINT =
  "DATABASE_URL points at a Supabase direct host (db.<ref>.supabase.co), which has no IPv4 route from Vercel; use the transaction pooler URI (aws-<n>-<region>.pooler.supabase.com:6543).";

async function probeDatabase(): Promise<HealthResponse["database"]> {
  const host_class = classifyDatabaseHost();

  if (!hasDatabaseConfig()) {
    return { configured: false, reachable: false, error: "NotConfigured", host_class };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new ProbeTimeoutError()), DB_PROBE_TIMEOUT_MS);
    });
    // Cheapest round trip that proves the connection is live, not merely configured.
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return { configured: true, reachable: true, host_class };
  } catch (error) {
    // Full detail stays server-side; only a recognised identifier goes public.
    console.error("[health] database probe failed", error);
    const failure: HealthResponse["database"] = {
      configured: true,
      reachable: false,
      error: describeFailure(error),
      host_class,
    };
    if (host_class === "supabase-direct") failure.hint = SUPABASE_DIRECT_HOST_HINT;
    return failure;
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
