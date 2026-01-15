import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ContactForm } from "@/components/portal/ContactForm";
import * as apiClient from "@/lib/api/client";

// Mock the API client
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ContactForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders contact form button", () => {
    render(<ContactForm />);

    expect(screen.getByRole("button", { name: /contact us/i })).toBeInTheDocument();
  });

  test("opens dialog when button is clicked", async () => {
    render(<ContactForm />);

    const button = screen.getByRole("button", { name: /contact us/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/send us a message/i)).toBeInTheDocument();
    });
  });

  test("shows validation errors for empty required fields", async () => {
    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /contact us/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/message must be at least 10 characters/i)).toBeInTheDocument();
    });
  });


  test("submits form with valid data", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({});

    render(<ContactForm source="walk-in" />);

    fireEvent.click(screen.getByRole("button", { name: /contact us/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "555-1234" },
    });
    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "Test Subject" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "This is a test message that is long enough." },
    });

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/contact-submissions",
        expect.objectContaining({
          name: "John Doe",
          email: "john@example.com",
          phone: "555-1234",
          subject: "Test Subject",
          message: "This is a test message that is long enough.",
          source: "walk-in",
        })
      );
    });
  });

  test("shows loading state during submission", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /contact us/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out minimum required fields
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "This is a test message." },
    });

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/sending.../i)).toBeInTheDocument();
    });
  });

  test("handles API error gracefully", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockRejectedValue(new Error("API Error"));

    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /contact us/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "This is a test message." },
    });

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalled();
    });

    // Dialog should still be open on error
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("closes dialog after successful submission", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({});

    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /contact us/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "This is a test message." },
    });

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  test("allows optional phone and subject fields to be empty", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({});

    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /contact us/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill only required fields
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "This is a test message." },
    });

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/contact-submissions",
        expect.objectContaining({
          name: "John Doe",
          email: "john@example.com",
          message: "This is a test message.",
        })
      );
    });
  });
});
