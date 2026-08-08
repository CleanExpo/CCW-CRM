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

/**
 * Identify the failure without leaking it. Prisma's message embeds the host,
 * and a driver error can carry the whole connection string, so only the error
 * code or constructor name crosses this boundary.
 */
function describeFailure(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) return code;
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && name.length > 0) return name;
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
      timer = setTimeout(() => reject(new Error("ProbeTimeout")), DB_PROBE_TIMEOUT_MS);
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
