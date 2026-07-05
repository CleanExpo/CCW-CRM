import { apiClient } from '@/lib/api/client';

export type Cin7Branch = {
  id: string;
  cin7_branch_id: string;
  name: string;
  branch_type: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  post_code: string | null;
  is_active: boolean;
  updated_at: string;
};

export type Cin7BranchListParams = {
  page?: number;
  page_size?: number;
  search?: string;
};

export type PaginatedCin7Branches = {
  items: Cin7Branch[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export async function listCin7Branches(
  params: Cin7BranchListParams = {}
): Promise<PaginatedCin7Branches> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.page_size) query.set('page_size', String(params.page_size));
  if (params.search) query.set('search', params.search);
  const qs = query.toString();
  return apiClient.get<PaginatedCin7Branches>(
    `/api/integrations/cin7/branches${qs ? `?${qs}` : ''}`
  );
}
