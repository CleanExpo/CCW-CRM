import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from '../empty-state';

describe('ErrorState', () => {
  it('announces the failed read as an alert with its title and description', () => {
    render(
      <ErrorState title="Couldn't load customers" description="The server did not respond." />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load customers");
    expect(alert).toHaveTextContent('The server did not respond.');
  });

  it('calls onRetry when Retry is pressed', async () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Couldn't load customers" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows no Retry button when there is nothing to retry', () => {
    render(<ErrorState title="Couldn't load customers" />);

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});
