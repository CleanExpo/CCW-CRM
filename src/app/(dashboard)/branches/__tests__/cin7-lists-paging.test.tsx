/**
 * UNI-2690: the Cin7 branches and internal-customers lists asked for page 1 of
 * 100 with no pager, so rows past the first page could not be reached.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api/cin7-branches', () => ({ listCin7Branches: vi.fn() }));
vi.mock('@/lib/api/customers', () => ({ customersApi: { list: vi.fn() } }));
vi.mock('@/components/integrations/Cin7MasterDataNav', () => ({ Cin7MasterDataNav: () => null }));
vi.mock('@/components/integrations/Cin7SyncButton', () => ({ Cin7PageSyncToolbar: () => null }));
vi.mock('@/components/integrations/Cin7EmptyState', () => ({ Cin7EmptyState: () => null }));

import { listCin7Branches } from '@/lib/api/cin7-branches';
import { customersApi } from '@/lib/api/customers';
import BranchesPage from '../page';
import InternalCustomersPage from '../../internal-customers/page';

const TOTAL = 132;

function pageOf<T>(item: T) {
  return (params?: { page?: number; page_size?: number }) =>
    Promise.resolve({
      items: [item],
      total: TOTAL,
      page: params?.page ?? 1,
      page_size: params?.page_size ?? 50,
      total_pages: Math.ceil(TOTAL / (params?.page_size ?? 50)),
    });
}

const branch = {
  id: 'b1',
  cin7_branch_id: 1,
  name: 'Brisbane',
  branch_type: 'Warehouse',
  city: 'Brisbane',
  state: 'QLD',
  post_code: '4000',
  email: null,
  phone: null,
  is_active: true,
};

const customer = {
  id: 'c1',
  company_name: 'CCW Sydney',
  contact_name: 'Store',
  email: null,
  phone: null,
  is_active: true,
};

const cases = [
  { name: 'branches', Page: BranchesPage, fn: listCin7Branches, item: branch },
  {
    name: 'internal customers',
    Page: InternalCustomersPage,
    fn: customersApi.list,
    item: customer,
  },
];

describe.each(cases)('$name list paging (UNI-2690)', ({ Page, fn, item }) => {
  const mockFn = fn as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFn.mockImplementation(pageOf(item));
  });

  it('shows the pager and requests page 2 when Next is clicked', async () => {
    render(<Page />);

    expect(await screen.findByText(`Showing 1-50 of ${TOTAL} items`)).toBeInTheDocument();
    expect(mockFn).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 50 }));

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(mockFn).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, page_size: 50 }))
    );
  });

  it('ignores a slow older page that lands after the user searched', async () => {
    let releaseOld: (v: unknown) => void = () => {};
    mockFn.mockImplementation((params?: { page?: number; search?: string }) => {
      if (params?.search)
        return pageOf({ ...item, id: 'hit', name: 'SEARCH-HIT', company_name: 'SEARCH-HIT' })(
          params
        );
      if ((params?.page ?? 1) === 2)
        return new Promise((resolve) => {
          releaseOld = resolve;
        });
      return pageOf(item)(params);
    });

    render(<Page />);
    await screen.findByText(`Showing 1-50 of ${TOTAL} items`);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(mockFn).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }))
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hit' } });
    expect(
      (await screen.findAllByText('SEARCH-HIT', {}, { timeout: 2000 })).length
    ).toBeGreaterThan(0);

    releaseOld({
      items: [{ ...item, id: 'old', name: 'OLD-PAGE-2', company_name: 'OLD-PAGE-2' }],
      total: TOTAL,
      page: 2,
      page_size: 50,
      total_pages: 3,
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.queryByText('OLD-PAGE-2')).not.toBeInTheDocument();
    expect(screen.getAllByText('SEARCH-HIT').length).toBeGreaterThan(0);
  });
});
