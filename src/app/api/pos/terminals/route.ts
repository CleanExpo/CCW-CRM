import { NextResponse } from 'next/server';

/** Default terminals aligned with `/api/pos/locations` codes. */
export async function GET() {
  return NextResponse.json([
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      terminal_id: 'TERM-BNE-01',
      location_code: 'brisbane',
      terminal_type: 'counter',
      is_active: true,
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      terminal_id: 'TERM-SYD-01',
      location_code: 'sydney',
      terminal_type: 'counter',
      is_active: true,
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
      terminal_id: 'TERM-MEL-01',
      location_code: 'melbourne',
      terminal_type: 'counter',
      is_active: true,
    },
  ]);
}
