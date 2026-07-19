import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import { LoginForm } from '@/components/auth/login-form';
import { MarketingHeader } from '@/components/landing/marketing-header';

describe('public account links', () => {
  it('does not advertise public signup in the marketing header', () => {
    render(<MarketingHeader />);

    expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('routes login-page access requests to contact instead of registration', () => {
    render(<LoginForm />);

    expect(screen.queryByRole('link', { name: /create an account/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request access/i })).toHaveAttribute(
      'href',
      '/contact'
    );
  });
});
