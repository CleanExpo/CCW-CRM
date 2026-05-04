import { notImplementedResponse } from '@/lib/integrations/not-implemented-response';

export async function GET() {
  return notImplementedResponse('AP2', 'Payment status');
}
