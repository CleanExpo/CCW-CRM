import { NextRequest } from 'next/server';
import { patchMeBodySchema } from '@/lib/auth/schemas';
import { readJsonBody, jsonDetail, jsonValidationError, jsonOk } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import {
  findAppUserById,
  updateAppUserProfile,
  emailExistsForOtherUser,
} from '@/lib/auth/app-user-repo';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';

export async function GET(request: NextRequest) {
  try {
    const claims = await getAuthClaimsFromRequest(request);
    if (!claims) {
      return jsonDetail('Not authenticated', 401);
    }

    const row = await findAppUserById(claims.sub);
    if (!row || !row.isActive) {
      return jsonDetail('Not authenticated', 401);
    }

    return jsonOk(mapAppUserRowToPublic(row));
  } catch (e) {
    console.error('[auth/me GET]', e);
    return jsonDetail('Profile service unavailable', 503);
  }
}

export async function PATCH(request: NextRequest) {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) {
    return jsonDetail('Not authenticated', 401);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = patchMeBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const row = await findAppUserById(claims.sub);
    if (!row || !row.isActive) {
      return jsonDetail('Not authenticated', 401);
    }

    if (parsed.data.email !== undefined) {
      const taken = await emailExistsForOtherUser(parsed.data.email, row.id);
      if (taken) {
        return jsonDetail('Email is already in use', 409);
      }
    }

    const updated = await updateAppUserProfile(row.id, {
      full_name: parsed.data.full_name,
      email: parsed.data.email,
    });
    if (!updated) {
      return jsonDetail('Update failed', 400);
    }

    return jsonOk(mapAppUserRowToPublic(updated));
  } catch (e) {
    console.error('[auth/me PATCH]', e);
    return jsonDetail('Profile service unavailable', 503);
  }
}
