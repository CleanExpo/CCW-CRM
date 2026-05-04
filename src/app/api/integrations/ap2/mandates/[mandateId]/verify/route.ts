import { notImplementedResponse } from '@/lib/integrations/not-implemented-response';

export async function POST() {
  return notImplementedResponse('AP2', 'Mandate verification');
}
