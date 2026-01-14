import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import WalkInPage from "@/app/(portal)/walk-in/page";
import * as apiClient from "@/lib/api/client";

// Mock the API client
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock lodash debounce
vi.mock("lodash", () => ({
  debounce: (fn: any) => fn,
}));

describe("Walk-In Portal", () => {
  const mockProduct = {
    id: "1",
    sku: "SKU-001",
    name: "Test Product",
    description: "Test description",
    category: "hand_tools",
    price: 99.99,
    stock: 10,
    warehouse_location: "Brisbane",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders walk-in checkout page", () => {
    render(<WalkInPage />);

    expect(screen.getByText("Walk-In Checkout")).toBeInTheDocument();
    expect(
      screen.getByText(
        /fast checkout for in-store customers/i
      )
    ).toBeInTheDocument();
  });

  test("renders product search component", () => {
    render(<WalkInPage />);

    expect(
      screen.getByPlaceholderText(/scan barcode or search by sku/i)
    ).toBeInTheDocument();
  });

  test("renders email receipt input", () => {
    render(<WalkInPage />);

    expect(
      screen.getByPlaceholderText(/customer@example.com/i)
    ).toBeInTheDocument();
  });

  test("displays payment buttons when cart has items", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    render(<WalkInPage />);

    // Add product to cart first
    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Product"));

    // Now payment buttons should be visible
    await waitFor(() => {
      expect(screen.getByText("Cash")).toBeInTheDocument();
      expect(screen.getByText("Card")).toBeInTheDocument();
      expect(screen.getByText("Account (Invoice)")).toBeInTheDocument();
    });
  });

  test("shows empty cart initially", () => {
    render(<WalkInPage />);

    expect(screen.getByText("Cart is empty")).toBeInTheDocument();
  });

  test("adds product to cart when selected", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    render(<WalkInPage />);

    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Product"));

    await waitFor(() => {
      expect(screen.queryByText("Cart is empty")).not.toBeInTheDocument();
    });
  });

  test("processes cash payment successfully", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({
      id: "order-1",
      order_number: "ORD-2026-001",
    });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test Product"));
    });

    // Click cash payment button
    await waitFor(() => {
      const cashButton = screen.getByText("Cash");
      fireEvent.click(cashButton);
    });

    // Verify order was created
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/orders",
        expect.objectContaining({
          channel: "walk-in",
          status: "confirmed",
        })
      );
    });
  });

  test("processes card payment successfully", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({
      id: "order-1",
      order_number: "ORD-2026-002",
    });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test Product"));
    });

    // Click card payment button
    await waitFor(() => {
      const cardButton = screen.getByText("Card");
      fireEvent.click(cardButton);
    });

    // Verify order was created
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/orders",
        expect.objectContaining({
          channel: "walk-in",
          status: "confirmed",
          payment_method: "card",
        })
      );
    });
  });

  test("processes account payment as pending order", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({
      id: "order-1",
      order_number: "ORD-2026-003",
    });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test Product"));
    });

    // Click account payment button
    await waitFor(() => {
      const accountButton = screen.getByText("Account (Invoice)");
      fireEvent.click(accountButton);
    });

    // Verify order was created as pending
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/orders",
        expect.objectContaining({
          channel: "walk-in",
          status: "pending",
          payment_method: "account",
        })
      );
    });
  });

  test("includes customer email in order if provided", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({
      id: "order-1",
      order_number: "ORD-2026-004",
    });

    render(<WalkInPage />);

    // Enter customer email
    const emailInput = screen.getByPlaceholderText(/customer@example.com/i);
    fireEvent.change(emailInput, {
      target: { value: "customer@test.com" },
    });

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test Product"));
    });

    // Process payment
    await waitFor(() => {
      const cashButton = screen.getByText("Cash");
      fireEvent.click(cashButton);
    });

    // Verify email was included
    await waitFor(() => {
      expect(apiClient.apiClient.post).toHaveBeenCalledWith(
        "/api/orders",
        expect.objectContaining({
          customer_email: "customer@test.com",
        })
      );
    });
  });

  test("clears cart after successful payment", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    vi.spyOn(apiClient.apiClient, "post").mockResolvedValue({
      id: "order-1",
      order_number: "ORD-2026-005",
    });

    render(<WalkInPage />);

    // Add product
    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test Product"));
    });

    // Process payment
    await waitFor(() => {
      const cashButton = screen.getByText("Cash");
      fireEvent.click(cashButton);
    });

    // Cart should be empty after successful payment
    await waitFor(() => {
      expect(screen.getByText("Cart is empty")).toBeInTheDocument();
    });
  });

  test("calculates total with tax correctly", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProduct],
    });

    render(<WalkInPage />);

    // Add product to cart
    const searchInput = screen.getByPlaceholderText(
      /scan barcode or search by sku/i
    );
    fireEvent.change(searchInput, { target: { value: "SKU-001" } });

    await waitFor(() => {
      fireEvent.click(screen.getByText("Test Product"));
    });

    // Verify total calculation
    // Subtotal: 99.99, Tax (10%): 9.999, Total: 109.989 ~ 109.99
    // Note: Total appears twice (cart summary + payment section)
    await waitFor(() => {
      const totals = screen.getAllByText("$109.99");
      expect(totals.length).toBeGreaterThanOrEqual(1);
    });
  });
});
