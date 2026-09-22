import { apiClient } from '@/lib/api/client';
import type { Phase2Area, Phase2AreaReport } from '@/lib/phase2/types';

export function comparePhase2Area(area: Phase2Area): Promise<Phase2AreaReport> {
  return apiClient.post<Phase2AreaReport>(
    `/api/phase2/compare?area=${area}`,
    {},
    undefined,
    300_000
  );
}

export function getPhase2SameAnswer(): Promise<Record<string, unknown>> {
  return apiClient.get('/api/phase2/same-answer', undefined, 300_000);
}
