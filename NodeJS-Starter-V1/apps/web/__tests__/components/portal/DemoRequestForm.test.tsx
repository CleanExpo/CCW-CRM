import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { DemoRequestForm } from "@/components/portal/DemoRequestForm";
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

describe("DemoRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders demo request button", () => {
    render(<DemoRequestForm />);

    expect(screen.getByRole("button", { name: /request demo/i })).toBeInTheDocument();
  });

  test("opens dialog when button is clicked", async () => {
    render(<DemoRequestForm />);

    const button = screen.getByRole("button", { name: /request demo/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/fill out the form below/i)).toBeInTheDocument();
    });
  });

  test("shows validation errors for empty required fields", async () => {
    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/company name required/i)).toBeInTheDocument();
      expect(screen.getByText(/contact name required/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/phone number required/i)).toBeInTheDocument();
    });
  });


  test("submits form with valid required data", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({});

    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out required fields using more specific selectors
    const companyInput = screen.getByPlaceholderText("Your Company");
    const contactInput = screen.getByPlaceholderText("Your name");
    const emailInput = screen.getByPlaceholderText("you@company.com");
    const phoneInput = screen.getByPlaceholderText("(555) 123-4567");

    fireEvent.change(companyInput, { target: { value: "ACME Corp" } });
    fireEvent.change(contactInput, { target: { value: "Jane Smith" } });
    fireEvent.change(emailInput, { target: { value: "jane@acme.com" } });
    fireEvent.change(phoneInput, { target: { value: "5551234567" } });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/demo-requests",
        expect.objectContaining({
          company_name: "ACME Corp",
          contact_name: "Jane Smith",
          email: "jane@acme.com",
          phone: "5551234567",
        })
      );
    });
  });

  test("submits form with all fields filled", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({});

    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out all fields using placeholder text
    fireEvent.change(screen.getByPlaceholderText("Your Company"), {
      target: { value: "ACME Corp" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Jane Smith" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "jane@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "5551234567" },
    });
    fireEvent.change(screen.getByPlaceholderText("Heavy Machinery, Power Tools, etc."), {
      target: { value: "Heavy Machinery" },
    });

    // Date input doesn't have placeholder, use label
    const dateInput = screen.getByLabelText(/preferred demo date/i);
    fireEvent.change(dateInput, {
      target: { value: "2026-02-15" },
    });

    fireEvent.change(screen.getByPlaceholderText("Any specific requirements or questions?"), {
      target: { value: "Looking for inventory management solutions" },
    });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/demo-requests",
        expect.objectContaining({
          company_name: "ACME Corp",
          contact_name: "Jane Smith",
          email: "jane@acme.com",
          phone: "5551234567",
          product_interest: "Heavy Machinery",
          preferred_date: "2026-02-15",
          notes: "Looking for inventory management solutions",
        })
      );
    });
  });

  test("shows loading state during submission", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out required fields using placeholder text
    fireEvent.change(screen.getByPlaceholderText("Your Company"), {
      target: { value: "ACME Corp" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Jane Smith" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "jane@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "5551234567" },
    });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/submitting.../i)).toBeInTheDocument();
    });
  });

  test("handles API error gracefully", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockRejectedValue(new Error("API Error"));

    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out the form using placeholder text
    fireEvent.change(screen.getByPlaceholderText("Your Company"), {
      target: { value: "ACME Corp" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Jane Smith" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "jane@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "5551234567" },
    });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalled();
    });

    // Dialog should still be open on error
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("closes dialog after successful submission", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({});

    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill out the form using placeholder text
    fireEvent.change(screen.getByPlaceholderText("Your Company"), {
      target: { value: "ACME Corp" },
    });
    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Jane Smith" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), {
      target: { value: "jane@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("(555) 123-4567"), {
      target: { value: "5551234567" },
    });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  test("validates phone number length", async () => {
    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill in other required fields
    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "Test Company" },
    });
    fireEvent.change(screen.getByLabelText(/contact name/i), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john@example.com" },
    });

    // Fill phone with invalid short value
    const phoneInput = screen.getByLabelText(/phone/i);
    fireEvent.change(phoneInput, { target: { value: "123" } });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Phone number required")).toBeInTheDocument();
    });
  });

  test("allows optional fields to be empty", async () => {
    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({});

    render(<DemoRequestForm />);

    fireEvent.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill only required fields
    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "ACME Corp" },
    });
    fireEvent.change(screen.getByLabelText(/contact name/i), {
      target: { value: "Jane Smith" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@acme.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "555-1234-5678" },
    });

    const submitButton = screen.getByRole("button", { name: /submit request/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/demo-requests",
        expect.objectContaining({
          company_name: "ACME Corp",
          contact_name: "Jane Smith",
          email: "jane@acme.com",
          phone: "555-1234-5678",
        })
      );
    });
  });
});
