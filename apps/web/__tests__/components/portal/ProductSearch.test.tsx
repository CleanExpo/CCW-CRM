import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ProductSearch } from "@/components/portal/ProductSearch";
import * as apiClient from "@/lib/api/client";

// Mock the API client
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Mock lodash debounce to execute immediately in tests
vi.mock("lodash", () => ({
  debounce: (fn: any) => fn,
}));

describe("ProductSearch", () => {
  const mockOnProductSelect = vi.fn();

  const mockProducts = [
    {
      id: "1",
      sku: "SKU-001",
      name: "Test Product 1",
      description: "Test description 1",
      category: "hand_tools",
      price: 99.99,
      stock: 10,
      warehouse_location: "Brisbane",
    },
    {
      id: "2",
      sku: "SKU-002",
      name: "Test Product 2",
      description: "Test description 2",
      category: "power_tools",
      price: 199.99,
      stock: 5,
      warehouse_location: "Sydney",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders search input", () => {
    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    expect(
      screen.getByPlaceholderText(/search by sku, name, or scan barcode/i)
    ).toBeInTheDocument();
  });

  test("displays search results when user types", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: mockProducts,
    });

    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    const input = screen.getByPlaceholderText(
      /search by sku, name, or scan barcode/i
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("Test Product 1")).toBeInTheDocument();
      expect(screen.getByText("Test Product 2")).toBeInTheDocument();
    });
  });

  test("calls onProductSelect when product is clicked", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: mockProducts,
    });

    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    const input = screen.getByPlaceholderText(
      /search by sku, name, or scan barcode/i
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("Test Product 1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Product 1"));

    expect(mockOnProductSelect).toHaveBeenCalledWith(mockProducts[0]);
  });

  test("shows 'In Stock' badge for products with stock > 10", async () => {
    const highStockProduct = {
      ...mockProducts[0],
      stock: 15,
    };

    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [highStockProduct],
    });

    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    const input = screen.getByPlaceholderText(
      /search by sku, name, or scan barcode/i
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("In Stock")).toBeInTheDocument();
    });
  });

  test("shows 'Low Stock' badge for products with 1-10 units", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [mockProducts[1]], // stock: 5
    });

    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    const input = screen.getByPlaceholderText(
      /search by sku, name, or scan barcode/i
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("Low Stock")).toBeInTheDocument();
    });
  });

  test("shows 'Out of Stock' badge for products with 0 stock", async () => {
    const outOfStockProduct = {
      ...mockProducts[0],
      stock: 0,
    };

    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [outOfStockProduct],
    });

    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    const input = screen.getByPlaceholderText(
      /search by sku, name, or scan barcode/i
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("Out of Stock")).toBeInTheDocument();
    });
  });

  test("shows 'No products found' message when search returns empty", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [],
    });

    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    const input = screen.getByPlaceholderText(
      /search by sku, name, or scan barcode/i
    );
    fireEvent.change(input, { target: { value: "nonexistent" } });

    await waitFor(() => {
      expect(
        screen.getByText(/no products found for "nonexistent"/i)
      ).toBeInTheDocument();
    });
  });

  test("clears search query after product selection", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: mockProducts,
    });

    render(<ProductSearch onProductSelect={mockOnProductSelect} />);

    const input = screen.getByPlaceholderText(
      /search by sku, name, or scan barcode/i
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(() => {
      expect(screen.getByText("Test Product 1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Product 1"));

    expect(input.value).toBe("");
  });
});
