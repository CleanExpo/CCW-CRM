import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl, sanitizeEnvValue } from "../database-url";

describe("database-url", () => {
  it("strips wrapping quotes", () => {
    expect(sanitizeEnvValue('"postgresql://localhost/db"')).toBe(
      "postgresql://localhost/db"
    );
  });

  it("converts postgresql+asyncpg to postgresql", () => {
    expect(
      normalizeDatabaseUrl(
        "postgresql+asyncpg://user:pass@host:5432/mydb?sslmode=require"
      )
    ).toBe("postgresql://user:pass@host:5432/mydb?sslmode=require");
  });

  it("accepts standard DigitalOcean style URLs", () => {
    expect(
      normalizeDatabaseUrl(
        "postgresql://doadmin:password@db.example.com:25060/defaultdb?sslmode=require"
      )
    ).toContain("postgresql://doadmin:");
  });
});
