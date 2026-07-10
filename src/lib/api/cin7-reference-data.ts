import { apiClient } from '@/lib/api/client';
import type { Cin7ReferenceListEntity } from '@/lib/integrations/cin7-reference-list';

export type Cin7ReferenceListParams = {
  page?: number;
  page_size?: number;
  search?: string;
};

export type PaginatedCin7ReferenceList = {
  entity: Cin7ReferenceListEntity;
  items: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export async function listCin7ReferenceData(
  entity: Cin7ReferenceListEntity,
  params: Cin7ReferenceListParams = {}
): Promise<PaginatedCin7ReferenceList> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return apiClient.get<PaginatedCin7ReferenceList>(
    `/api/integrations/cin7/reference/${entity}${qs ? `?${qs}` : ''}`
  );
}
