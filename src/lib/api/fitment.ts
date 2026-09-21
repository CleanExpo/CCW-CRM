import { apiClient } from '@/lib/api/client';

export type FitmentProduct = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  price: number;
};

export type Fitment = {
  id: string;
  kind: 'consumable' | 'part' | 'accessory';
  status: 'suggested' | 'confirmed' | 'rejected';
  source: 'manual' | 'import' | 'bom' | 'order_history';
  evidence: string | null;
  usage_quantity: number | null;
  usage_per: string | null;
  confirmed_at: string | null;
  machine: FitmentProduct;
  product: FitmentProduct;
};

export const fitmentApi = {
  list: (params: { status?: string; search?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    return apiClient.get<{ items: Fitment[]; total: number; page: number; page_size: number }>(
      `/api/fitment?${q.toString()}`
    );
  },
  forMachine: (machineProductId: string) =>
    apiClient.get<{ items: Fitment[] }>(
      `/api/fitment?machine_product_id=${encodeURIComponent(machineProductId)}`
    ),
  forProduct: (productId: string) =>
    apiClient.get<{ items: Fitment[] }>(`/api/fitment?product_id=${encodeURIComponent(productId)}`),
  forEquipment: (equipmentId: string) =>
    apiClient.get<{ linked: boolean; machine_product_id: string | null; items: Fitment[] }>(
      `/api/fitment?equipment_id=${encodeURIComponent(equipmentId)}`
    ),
  create: (data: {
    machine_product_id: string;
    fit_product_id: string;
    kind: string;
    usage_quantity?: number | null;
    usage_per?: string | null;
  }) => apiClient.post<Fitment>('/api/fitment', data),
  review: (id: string, data: { status?: string; kind?: string }) =>
    apiClient.patch<Fitment>(`/api/fitment/${id}`, data),
  remove: (id: string) => apiClient.delete<{ deleted: boolean }>(`/api/fitment/${id}`),
  importCsv: (csv: string, confirm: boolean) =>
    apiClient.post<{ imported: number; errors: { line: number; message: string }[] }>(
      '/api/fitment/import',
      { csv, confirm }
    ),
  suggest: () =>
    apiClient.post<{ from_bom: number; from_orders: number; skipped_existing: number }>(
      '/api/fitment/suggest'
    ),
};
