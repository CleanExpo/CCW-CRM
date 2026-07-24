// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { verifyAccessJwt } from '@/lib/auth/jwt-tokens';
import { prisma } from '@/lib/db/prisma';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseHost = testDatabaseUrl ? new URL(testDatabaseUrl).hostname : null;
const isLocalTestDatabase = testDatabaseHost === '127.0.0.1' || testDatabaseHost === 'localhost';
if (isLocalTestDatabase && testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;
const describeWithPostgres = isLocalTestDatabase ? describe : describe.skip;
const emailSuffix = '@registration-concurrency.invalid';

function requestFor(email: string) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'PostgresTestPassword123!',
      full_name: 'Concurrency Test',
      role: 'owner',
      is_admin: true,
    }),
  });
}

async function removeTestUsers() {
  await prisma.appUser.deleteMany({ where: { email: { endsWith: emailSuffix } } });
}

describeWithPostgres('public registration with disposable PostgreSQL', () => {
  beforeEach(async () => {
    await removeTestUsers();
  });

  afterAll(async () => {
    await removeTestUsers();
    await prisma.$disconnect();
  });

  it('persists and signs only least-privilege claims across parallel registrations', async () => {
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        registerPost(requestFor(`parallel-${index}${emailSuffix}`))
      )
    );
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(bodies.every((body) => body.user.role === 'member' && body.user.is_admin === false)).toBe(
      true
    );

    const persisted = await prisma.appUser.findMany({
      where: { email: { endsWith: emailSuffix } },
      orderBy: { email: 'asc' },
    });
    expect(persisted).toHaveLength(8);
    expect(persisted.every((row) => row.role === 'member' && row.isAdmin === false)).toBe(true);

    const claims = await Promise.all(
      bodies.map((body) => verifyAccessJwt(body.access_token as string))
    );
    expect(claims.every((claim) => claim?.role === 'member' && claim.is_admin === false)).toBe(true);
  });

  it('normalises mixed-case email races to one member and one conflict', async () => {
    const [upper, lower] = await Promise.all([
      registerPost(requestFor(`Mixed.Case${emailSuffix}`)),
      registerPost(requestFor(`mixed.case${emailSuffix}`)),
    ]);

    expect([upper.status, lower.status].sort()).toEqual([200, 409]);
    const persisted = await prisma.appUser.findMany({
      where: { email: `mixed.case${emailSuffix}` },
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ role: 'member', isAdmin: false });
  });
});
