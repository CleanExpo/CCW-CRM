import { notImplementedResponse } from '@/lib/integrations/not-implemented-response';

export async function POST() {
  return notImplementedResponse('HeyGen', 'Video generation');
}
