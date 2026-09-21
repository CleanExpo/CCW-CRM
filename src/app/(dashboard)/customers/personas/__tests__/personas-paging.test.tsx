/**
 * UNI-2690: the personas list asked for one page of 200 with no pager, so
 * customers past the first 200 could not be reached.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

import { apiClient } from '@/lib/api/client';
import PersonasPage from '../page';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const TOTAL = 132;

describe('personas list paging (UNI-2690)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      const params = new URL(url, 'http://test').searchParams;
      const pageSize = Number(params.get('page_size') || 50);
      return Promise.resolve({
        items: [
          {
            customer_id: 'c1',
            company_name: 'Acme Cleaning',
            persona: 'consumables',
            confidence: 'high',
            reason: 'Frequent orders',
            classified_at: null,
          },
        ],
        total: TOTAL,
        page: Number(params.get('page') || 1),
        page_size: pageSize,
        total_pages: Math.ceil(TOTAL / pageSize),
        summary: {},
      });
    });
  });

  it('shows the pager and requests page 2 when Next is clicked', async () => {
    render(<PersonasPage />);

    expect(await screen.findByText(`Showing 1-50 of ${TOTAL} items`)).toBeInTheDocument();
    expect(mockGet).toHaveBeenLastCalledWith(expect.stringMatching(/[?&]page=1&page_size=50\b/));

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith(expect.stringMatching(/[?&]page=2&page_size=50\b/))
    );
  });
});
