import { NextResponse } from 'next/server';

/** Default POS locations until locations are persisted in the database. */
export async function GET() {
  return NextResponse.json([
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      code: 'brisbane',
      name: 'Brisbane',
      location_type: 'physical' as const,
      city: 'Brisbane',
      state: 'QLD',
      is_active: true,
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      code: 'sydney',
      name: 'Sydney',
      location_type: 'physical' as const,
      city: 'Sydney',
      state: 'NSW',
      is_active: true,
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
      code: 'melbourne',
      name: 'Melbourne',
      location_type: 'physical' as const,
      city: 'Melbourne',
      state: 'VIC',
      is_active: true,
    },
  ]);
}
