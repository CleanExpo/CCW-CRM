import { NextResponse } from 'next/server';

/** Consistent 501 for optional integration backends that are not deployed in this build. */
export function notImplementedResponse(integration: string, feature = 'This endpoint') {
  return NextResponse.json(
    {
      detail: `${feature} is not enabled for ${integration} in this environment.`,
      code: 'not_implemented',
    },
    { status: 501 }
  );
}
