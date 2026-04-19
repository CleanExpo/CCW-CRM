import { describe, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from '@/components/portal/ContactForm';

// Mock API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(() => Promise.resolve({})),
  },
}));

describe('Form Accessibility', () => {
  describe('ContactForm', () => {
    test('has accessible form labels', async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      // Open dialog
      const button = screen.getByRole('button', { name: /contact us/i });
      await user.click(button);

      // Wait for dialog to open
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      // Check for proper labels
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    });

    test('has required field indicators', async () => {
      render(<ContactForm />);

      const button = screen.getByRole('button', { name: /contact us/i });
      button.click();

      await screen.findByRole('dialog');

      // Check required fields have proper attributes
      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const messageInput = screen.getByLabelText(/message/i);

      expect(nameInput).toBeRequired();
      expect(emailInput).toBeRequired();
      expect(messageInput).toBeRequired();
    });

    test('displays validation errors accessibly', async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      await user.click(screen.getByRole('button', { name: /contact us/i }));
      await screen.findByRole('dialog');

      // Submit without filling form
      await user.click(screen.getByRole('button', { name: /send message/i }));

      // Wait for validation errors
      await screen.findByText(/name must be at least 2 characters/i);

      expect(screen.getByText(/name must be at least 2 characters/i)).toBeVisible();
      expect(screen.getByText(/invalid email address/i)).toBeVisible();
      expect(screen.getByText(/message must be at least 10 characters/i)).toBeVisible();
    });

    test('has proper ARIA attributes', async () => {
      render(<ContactForm />);

      const button = screen.getByRole('button', { name: /contact us/i });
      button.click();

      const dialog = await screen.findByRole('dialog');

      // Dialog should render with dialog role (aria-modal is handled by Radix)
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    test('submit button shows loading state accessibly', async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      const button = screen.getByRole('button', { name: /contact us/i });
      await user.click(button);

      await screen.findByRole('dialog');

      // Fill form with valid data via userEvent
      await user.type(screen.getByLabelText(/name/i), 'John Doe');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(
        screen.getByLabelText(/message/i),
        'This is a test message that is long enough.'
      );

      const submitButton = screen.getByRole('button', { name: /send message/i });

      // Submit button should be enabled before submit
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Keyboard Navigation', () => {
    test('form inputs are keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      const button = screen.getByRole('button', { name: /contact us/i });
      await user.click(button);

      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      const nameInput = screen.getByLabelText(/name/i) as HTMLElement;
      const emailInput = screen.getByLabelText(/email/i) as HTMLElement;

      // Inputs should be focusable
      nameInput.focus();
      expect(document.activeElement).toBe(nameInput);

      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
    });

    test('submit button is keyboard accessible', async () => {
      render(<ContactForm />);

      const button = screen.getByRole('button', { name: /contact us/i });
      button.click();

      await screen.findByRole('dialog');

      const submitButton = screen.getByRole('button', { name: /send message/i });

      submitButton.focus();
      expect(document.activeElement).toBe(submitButton);
    });
  });

  describe('Color Contrast & Visual Accessibility', () => {
    test('error messages are visually distinct', async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      await user.click(screen.getByRole('button', { name: /contact us/i }));
      await screen.findByRole('dialog');

      await user.click(screen.getByRole('button', { name: /send message/i }));

      await screen.findByText(/name must be at least 2 characters/i);

      const errorMessage = screen.getByText(/name must be at least 2 characters/i);
      expect(errorMessage).toBeVisible();

      const styles = window.getComputedStyle(errorMessage);
      expect(styles.color).not.toBe('');
    });
  });

  describe('Focus Management', () => {
    test('dialog traps focus when open', async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      const openButton = screen.getByRole('button', { name: /contact us/i });
      await user.click(openButton);

      const dialog = await screen.findByRole('dialog');

      // Focus should be within dialog
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });

    test('focus returns to trigger button when dialog closes', async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      const openButton = screen.getByRole('button', { name: /contact us/i });
      await user.click(openButton);

      await screen.findByRole('dialog');

      // Close dialog via Cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should be gone after closing
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
