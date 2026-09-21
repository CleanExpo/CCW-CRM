/**
 * UNI-2690: the personas list asked for one page of 200 with no pager, so
 * customers past the first 200 could not be reached.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

  it('ignores a slow page 2 that lands after the user picked a persona', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    let releaseOld: (v: unknown) => void = () => {};
    const row = (name: string) => ({
      customer_id: name,
      company_name: name,
      persona: 'consumables',
      confidence: 'high',
      reason: '',
      classified_at: null,
    });
    const body = (name: string, page: number) => ({
      items: [row(name)],
      total: TOTAL,
      page,
      page_size: 50,
      total_pages: 3,
      summary: {},
    });
    mockGet.mockImplementation((url: string) => {
      const params = new URL(url, 'http://test').searchParams;
      if (params.get('persona_filter')) return Promise.resolve(body('FILTERED-ROW', 1));
      if (params.get('page') === '2')
        return new Promise((resolve) => {
          releaseOld = resolve;
        });
      return Promise.resolve(body('PAGE-ONE', 1));
    });

    render(<PersonasPage />);
    await screen.findByText(`Showing 1-50 of ${TOTAL} items`);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith(expect.stringMatching(/[?&]page=2&/))
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /High Value/ }));
    expect(await screen.findByText('FILTERED-ROW')).toBeInTheDocument();

    releaseOld(body('OLD-PAGE-2', 2));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.queryByText('OLD-PAGE-2')).not.toBeInTheDocument();
    expect(screen.getByText('FILTERED-ROW')).toBeInTheDocument();
  });
});
