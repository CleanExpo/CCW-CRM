/**
 * Environment configuration with validation
 * Ensures all required environment variables are present at startup
 */

import { hasDatabaseConfig } from "@/lib/db/database-env";

const OPTIONAL_ENV_VARS = {
  NEXT_PUBLIC_FRONTEND_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
} as const;

function validateEnv(): void {
  const missing: string[] = [];

  if (!hasDatabaseConfig()) {
    missing.push("DATABASE_URL (or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)");
  }

  if (!process.env.JWT_SECRET && !process.env.JWT_SECRET_KEY) {
    missing.push("JWT_SECRET (or JWT_SECRET_KEY)");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((key) => `  - ${key}`).join("\n")}\n\n` +
        `Please add these to your .env.local file or environment configuration.`
    );
  }
}

if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  validateEnv();
}

export const config = {
  frontend: {
    url: process.env.NEXT_PUBLIC_FRONTEND_URL || OPTIONAL_ENV_VARS.NEXT_PUBLIC_FRONTEND_URL,
  },
  logging: {
    level: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || OPTIONAL_ENV_VARS.LOG_LEVEL,
  },
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
} as const;

export const isClient = typeof window !== "undefined";
export const isServer = typeof window === "undefined";

export default config;
