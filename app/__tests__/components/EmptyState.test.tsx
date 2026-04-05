import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';

describe('EmptyState', () => {
  it('renders icon and title', () => {
    render(<EmptyState icon={Package} title="No items found" />);

    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /no items found/i })).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        icon={Package}
        title="No items"
        description="Add your first item to get started"
      />
    );

    expect(screen.getByText('Add your first item to get started')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState icon={Package} title="No items" />);

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });

  it('renders action button when provided', () => {
    const handleClick = vi.fn();

    render(
      <EmptyState
        icon={Package}
        title="No items"
        action={{ label: 'Add Item', onClick: handleClick }}
      />
    );

    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
  });

  it('calls onClick when action button is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <EmptyState
        icon={Package}
        title="No items"
        action={{ label: 'Add Item', onClick: handleClick }}
      />
    );

    const button = screen.getByRole('button', { name: /add item/i });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('does not render action button when not provided', () => {
    render(<EmptyState icon={Package} title="No items" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState icon={Package} title="No items" className="custom-class" />
    );

    const emptyState = container.firstChild as HTMLElement;
    expect(emptyState).toHaveClass('custom-class');
  });
});
