import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      id: 'cccccccc-cccc-cccc-cccc-ccccccccccc1',
      staff_code: 'S001',
      full_name: 'Alex Morgan',
      email: 'alex@example.com',
      primary_location_code: 'brisbane',
      is_active: true,
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-ccccccccccc2',
      staff_code: 'S002',
      full_name: 'Sam Taylor',
      email: 'sam@example.com',
      primary_location_code: 'sydney',
      is_active: true,
    },
  ]);
}
