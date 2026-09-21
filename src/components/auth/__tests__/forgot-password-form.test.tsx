import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/auth', () => ({
  authApi: { requestPasswordReset: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import toast from 'react-hot-toast';
import { authApi } from '@/lib/api/auth';
import { ForgotPasswordForm } from '../forgot-password-form';

const GENERIC =
  'If an account exists with that email, a password reset link is on its way. Check your inbox, including junk mail.';

const requestPasswordReset = vi.mocked(authApi.requestPasswordReset);

async function submit(email = 'ops@example.com') {
  render(<ForgotPasswordForm />);
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
}

describe('ForgotPasswordForm delivery status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['refused', 'failed'])(
    'tells the user resets are unavailable when delivery is %s',
    async (status) => {
      requestPasswordReset.mockResolvedValue({
        message: GENERIC,
        delivery: { status },
      });

      await submit();

      await waitFor(() => {
        expect(screen.getByText(/password resets are unavailable right now/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/contact an administrator/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/if an account exists for that address, we sent reset instructions/i)
      ).not.toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
    }
  );

  it('shows the success confirmation when delivery is sent', async () => {
    requestPasswordReset.mockResolvedValue({
      message: GENERIC,
      delivery: { status: 'sent', receipt_id: 'r1' },
    });

    await submit();

    await waitFor(() => {
      expect(
        screen.getByText(/if an account exists for that address, we sent reset instructions/i)
      ).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith(GENERIC);
    expect(screen.queryByText(/password resets are unavailable/i)).not.toBeInTheDocument();
  });

  it('keeps the generic confirmation for an unknown account so existence is not revealed', async () => {
    requestPasswordReset.mockResolvedValue({
      message: GENERIC,
      delivery: { status: 'not_applicable' },
    });

    await submit('nobody@example.com');

    await waitFor(() => {
      expect(
        screen.getByText(/if an account exists for that address, we sent reset instructions/i)
      ).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith(GENERIC);
    expect(screen.queryByText(/password resets are unavailable/i)).not.toBeInTheDocument();
  });
});
