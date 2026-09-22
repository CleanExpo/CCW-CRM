#!/usr/bin/env node
/**
 * Deterministic owner + catalogue for UNI-2108.
 * Refuses a remote database unless SMOKE_ALLOW_REMOTE=1.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { resolveDatabaseUrl } from '../database-url.mjs';

config();

const EMAIL = (process.env.E2E_EMAIL || 'smoke.owner@local.test').toLowerCase();
const PASSWORD = process.env.E2E_PASSWORD || 'SmokeOwner12ab';

function isLocal(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

const resolved = resolveDatabaseUrl();
if (!resolved?.url) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

const host = new URL(resolved.url.replace(/^postgres:/, 'postgresql:')).hostname;
if (!isLocal(host) && process.env.SMOKE_ALLOW_REMOTE !== '1') {
  console.error(
    'Refusing to seed a remote database. Set SMOKE_ALLOW_REMOTE=1 only for a dedicated smoke DB.'
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: resolved.url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  let user = await prisma.appUser.findUnique({ where: { email: EMAIL } });
  if (!user) {
    const id = randomUUID();
    user = await prisma.appUser.create({
      data: {
        id,
        email: EMAIL,
        passwordHash,
        fullName: 'Smoke Owner',
        role: 'owner',
        isAdmin: true,
        workspaceId: id,
        mustChangePassword: false,
      },
    });
  } else {
    await prisma.appUser.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, isActive: true, totpEnabled: false },
    });
  }

  const sku = 'SMOKE-SKU-1';
  const existingProduct = await prisma.product.findFirst({
    where: { ownerUserId: user.id, sku },
  });
  if (!existingProduct) {
    await prisma.product.create({
      data: {
        ownerUserId: user.id,
        name: 'Smoke washer',
        sku,
        category: 'equipment',
        price: 100,
        stock: 20,
        warehouseLocation: 'brisbane',
        isActive: true,
      },
    });
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: { ownerUserId: user.id, email: 'smoke.customer@local.test' },
  });
  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        ownerUserId: user.id,
        companyName: 'Smoke Customer Co',
        contactName: 'Casey Smoke',
        email: 'smoke.customer@local.test',
        city: 'Brisbane',
        isActive: true,
      },
    });
  }

  console.log(`seeded ${EMAIL}`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
