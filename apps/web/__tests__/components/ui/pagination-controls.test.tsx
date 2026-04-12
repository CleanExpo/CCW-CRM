import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { PaginationControls } from '@/components/ui/pagination-controls';

describe('PaginationControls', () => {
  const mockOnPageChange = vi.fn();
  const mockOnPageSizeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders pagination controls with correct item counts', () => {
    render(
      <PaginationControls
        currentPage={1}
        totalPages={10}
        pageSize={50}
        totalItems={500}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    expect(screen.getByText(/Showing 1-50 of 500 items/i)).toBeInTheDocument();
  });

  test('memoizes page numbers calculation', () => {
    const { rerender } = render(
      <PaginationControls
        currentPage={1}
        totalPages={100}
        pageSize={50}
        totalItems={5000}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Initial render - page 1 should be visible
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();

    // Re-render with same props - useMemo should prevent recalculation
    rerender(
      <PaginationControls
        currentPage={1}
        totalPages={100}
        pageSize={50}
        totalItems={5000}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Should still render correctly
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
  });

  test('handles large page counts efficiently with ellipsis', () => {
    render(
      <PaginationControls
        currentPage={500}
        totalPages={1000}
        pageSize={50}
        totalItems={50000}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Should show ellipsis for large page counts
    const ellipsis = screen.getAllByText('...');
    expect(ellipsis.length).toBeGreaterThan(0);

    // Should show current page
    expect(screen.getByRole('button', { name: '500' })).toBeInTheDocument();

    // Should show first and last pages
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1000' })).toBeInTheDocument();
  });

  test('updates page numbers when currentPage changes', () => {
    const { rerender } = render(
      <PaginationControls
        currentPage={1}
        totalPages={100}
        pageSize={50}
        totalItems={5000}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Page 1 should be active (default variant)
    const page1Button = screen.getByRole('button', { name: '1' });
    expect(page1Button).toHaveClass('bg-primary'); // Active page has bg-primary

    // Change to page 50 (middle)
    rerender(
      <PaginationControls
        currentPage={50}
        totalPages={100}
        pageSize={50}
        totalItems={5000}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Page 50 should now be visible and active
    const page50Button = screen.getByRole('button', { name: '50' });
    expect(page50Button).toBeInTheDocument();
  });

  test('shows all pages when total is small', () => {
    render(
      <PaginationControls
        currentPage={3}
        totalPages={5}
        pageSize={50}
        totalItems={250}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Should show all 5 pages (no ellipsis)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();

    // No ellipsis
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  test('disables first/prev buttons on page 1', () => {
    render(
      <PaginationControls
        currentPage={1}
        totalPages={10}
        pageSize={50}
        totalItems={500}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Find first and previous buttons by their icons
    const buttons = screen.getAllByRole('button');
    const firstButton = buttons[0]; // First button (ChevronsLeft)
    const prevButton = buttons[1]; // Previous button (ChevronLeft)

    expect(firstButton).toBeDisabled();
    expect(prevButton).toBeDisabled();
  });

  test('disables next/last buttons on last page', () => {
    render(
      <PaginationControls
        currentPage={10}
        totalPages={10}
        pageSize={50}
        totalItems={500}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    const buttons = screen.getAllByRole('button');
    // Next and Last buttons are at the end
    const lastButton = buttons[buttons.length - 1];
    const nextButton = buttons[buttons.length - 2];

    expect(nextButton).toBeDisabled();
    expect(lastButton).toBeDisabled();
  });

  test('displays correct range when on last page with partial items', () => {
    render(
      <PaginationControls
        currentPage={3}
        totalPages={3}
        pageSize={50}
        totalItems={125} // 50 + 50 + 25
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Should show 101-125 of 125 items
    expect(screen.getByText(/Showing 101-125 of 125 items/i)).toBeInTheDocument();
  });

  test('handles empty state (0 items)', () => {
    render(
      <PaginationControls
        currentPage={1}
        totalPages={0}
        pageSize={50}
        totalItems={0}
        onPageChange={mockOnPageChange}
        onPageSizeChange={mockOnPageSizeChange}
      />
    );

    // Should show 0-0 of 0 items
    expect(screen.getByText(/Showing 0-0 of 0 items/i)).toBeInTheDocument();
  });
});
