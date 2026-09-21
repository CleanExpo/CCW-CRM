/**
 * UNI-2688: CCW sells cleaning equipment and consumables, so the products list
 * says "products", not "equipment".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/products',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock('@/hooks/use-sse', () => ({
  useInventoryStream: () => ({
    data: null,
    status: 'disconnected',
    stats: { messagesReceived: 0 },
  }),
}));

vi.mock('@/components/integrations/Cin7MasterDataNav', () => ({
  Cin7MasterDataNav: () => null,
}));
vi.mock('@/components/integrations/Cin7SyncButton', () => ({
  Cin7PageSyncToolbar: () => null,
}));
vi.mock('../../inventory/components/StockTransferDialog', () => ({
  StockTransferDialog: () => null,
}));
vi.mock('../components/BulkDeleteProductsDialog', () => ({
  BulkDeleteProductsDialog: () => null,
}));
vi.mock('../components/DeleteProductDialog', () => ({
  DeleteProductDialog: () => null,
}));
vi.mock('../components/ProductForm', () => ({
  ProductForm: () => null,
}));

import { apiClient } from '@/lib/api/client';
import ProductsPage from '../page';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;

describe('Products page wording (UNI-2688)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
  });

  it('says products, not equipment, in the catalogue card and empty state', async () => {
    render(<ProductsPage />);

    expect(await screen.findByText('No products found')).toBeInTheDocument();
    expect(screen.getByText('Add your first product to get started.')).toBeInTheDocument();
    expect(screen.getByText('Product Catalogue')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Search by product name, model, or SKU...')
    ).toBeInTheDocument();
    expect(screen.queryByText(/equipment/i)).not.toBeInTheDocument();
  });
});
