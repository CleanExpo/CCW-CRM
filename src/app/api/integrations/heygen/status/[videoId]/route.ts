import { notImplementedResponse } from '@/lib/integrations/not-implemented-response';

export async function GET() {
  return notImplementedResponse('HeyGen', 'Video status');
}
