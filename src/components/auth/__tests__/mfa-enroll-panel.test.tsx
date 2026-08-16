import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MfaEnrollPanel } from '../mfa-enroll-panel';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,qr'),
  },
}));

describe('MfaEnrollPanel', () => {
  it('renders a local QR image from the otpauth URI, secret, and recovery codes', async () => {
    render(
      <MfaEnrollPanel
        secret="SECRETBASE32"
        otpauthUri="otpauth://totp/Optix:ops@example.com?secret=SECRETBASE32"
        recoveryCodes={['AAAA-1111']}
        code=""
        onCodeChange={() => undefined}
        onConfirm={() => undefined}
        confirmLabel="Enable MFA and sign in"
      />
    );

    await waitFor(() => {
      expect(screen.getByAltText('Authenticator QR code')).toHaveAttribute(
        'src',
        'data:image/png;base64,qr'
      );
    });
    expect(screen.getByText('SECRETBASE32')).toBeInTheDocument();
    expect(screen.getByText('AAAA-1111')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable mfa and sign in/i })).toBeDisabled();
  });
});
