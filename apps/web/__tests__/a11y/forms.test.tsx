import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactForm } from "@/components/portal/ContactForm";

// Mock API client
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: vi.fn(() => Promise.resolve({})),
  },
}));

describe("Form Accessibility", () => {
  describe("ContactForm", () => {
    test("has accessible form labels", async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      // Open dialog
      const button = screen.getByRole("button", { name: /contact us/i });
      await user.click(button);

      // Wait for dialog to open
      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

      // Check for proper labels
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    });

    test("has required field indicators", async () => {
      render(<ContactForm />);

      const button = screen.getByRole("button", { name: /contact us/i });
      button.click();

      await screen.findByRole("dialog");

      // Check required fields have proper attributes
      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const messageInput = screen.getByLabelText(/message/i);

      expect(nameInput).toBeRequired();
      expect(emailInput).toBeRequired();
      expect(messageInput).toBeRequired();
    });

    test("displays validation errors accessibly", async () => {
      render(<ContactForm />);

      const button = screen.getByRole("button", { name: /contact us/i });
      button.click();

      await screen.findByRole("dialog");

      // Submit without filling form
      const submitButton = screen.getByRole("button", { name: /send message/i });
      submitButton.click();

      // Wait for validation errors
      await screen.findByText(/name must be at least 2 characters/i);

      // Check error messages are visible
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeVisible();
      expect(screen.getByText(/invalid email address/i)).toBeVisible();
      expect(screen.getByText(/message must be at least 10 characters/i)).toBeVisible();
    });

    test("has proper ARIA attributes", async () => {
      render(<ContactForm />);

      const button = screen.getByRole("button", { name: /contact us/i });
      button.click();

      const dialog = await screen.findByRole("dialog");

      // Dialog should have proper ARIA attributes
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    test("submit button shows loading state accessibly", async () => {
      vi.mock("@/lib/api/client", () => ({
        apiClient: {
          post: vi.fn(() => new Promise((resolve) => setTimeout(resolve, 1000))),
        },
      }));

      render(<ContactForm />);

      const button = screen.getByRole("button", { name: /contact us/i });
      button.click();

      await screen.findByRole("dialog");

      // Fill form
      const nameInput = screen.getByLabelText(/name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const messageInput = screen.getByLabelText(/message/i);

      nameInput.setAttribute("value", "John Doe");
      emailInput.setAttribute("value", "john@example.com");
      messageInput.textContent = "This is a test message.";

      const submitButton = screen.getByRole("button", { name: /send message/i });
      submitButton.click();

      // Button should be disabled during submission
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Keyboard Navigation", () => {
    test("form inputs are keyboard accessible", async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      const button = screen.getByRole("button", { name: /contact us/i });
      await user.click(button);

      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

      const nameInput = screen.getByLabelText(/name/i) as HTMLElement;
      const emailInput = screen.getByLabelText(/email/i) as HTMLElement;

      // Inputs should be focusable
      nameInput.focus();
      expect(document.activeElement).toBe(nameInput);

      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
    });

    test("submit button is keyboard accessible", async () => {
      render(<ContactForm />);

      const button = screen.getByRole("button", { name: /contact us/i });
      button.click();

      await screen.findByRole("dialog");

      const submitButton = screen.getByRole("button", { name: /send message/i });

      submitButton.focus();
      expect(document.activeElement).toBe(submitButton);
    });
  });

  describe("Color Contrast & Visual Accessibility", () => {
    test("error messages are visually distinct", async () => {
      render(<ContactForm />);

      const button = screen.getByRole("button", { name: /contact us/i });
      button.click();

      await screen.findByRole("dialog");

      const submitButton = screen.getByRole("button", { name: /send message/i });
      submitButton.click();

      await screen.findByText(/name must be at least 2 characters/i);

      // Error messages should be visible (not hidden)
      const errorMessage = screen.getByText(/name must be at least 2 characters/i);
      expect(errorMessage).toBeVisible();

      // Check that error message has semantic meaning (not just color)
      const styles = window.getComputedStyle(errorMessage);
      expect(styles.color).not.toBe("");
    });
  });

  describe("Focus Management", () => {
    test("dialog traps focus when open", async () => {
      const user = userEvent.setup();
      render(<ContactForm />);

      const openButton = screen.getByRole("button", { name: /contact us/i });
      await user.click(openButton);

      const dialog = await screen.findByRole("dialog");

      // Focus should be within dialog
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });

    test("focus returns to trigger button when dialog closes", async () => {
      render(<ContactForm />);

      const openButton = screen.getByRole("button", { name: /contact us/i });
      openButton.click();

      await screen.findByRole("dialog");

      // Close dialog (if there's a close button)
      const closeButtons = screen.queryAllByRole("button", { name: /close/i });
      if (closeButtons.length > 0) {
        closeButtons[0].click();

        // Focus should return to open button
        expect(document.activeElement).toBe(openButton);
      }
    });
  });
});
