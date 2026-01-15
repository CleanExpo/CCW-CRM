import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { CartManager } from "@/components/portal/CartManager";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("CartManager", () => {
  const mockItems = [
    {
      id: "1",
      sku: "SKU-001",
      name: "Test Product 1",
      price: 100,
      quantity: 2,
      stock: 10,
    },
    {
      id: "2",
      sku: "SKU-002",
      name: "Test Product 2",
      price: 50,
      quantity: 1,
      stock: 5,
    },
  ];

  const mockHandlers = {
    onUpdateQuantity: vi.fn(),
    onRemoveItem: vi.fn(),
    onClearCart: vi.fn(),
  };

  test("renders empty cart message when no items", () => {
    render(
      <CartManager
        items={[]}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    expect(screen.getByText("Cart is empty")).toBeInTheDocument();
  });

  test("displays cart items with correct details", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    expect(screen.getByText("Test Product 1")).toBeInTheDocument();
    expect(screen.getByText("Test Product 2")).toBeInTheDocument();
    expect(screen.getByText("SKU: SKU-001")).toBeInTheDocument();
    expect(screen.getByText("$100.00 each")).toBeInTheDocument();
  });

  test("calculates subtotal correctly", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    // Subtotal: (100 * 2) + (50 * 1) = 250
    expect(screen.getByText("$250.00")).toBeInTheDocument();
  });

  test("calculates tax correctly", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
        taxRate={0.1}
        showTax={true}
      />
    );

    // Tax: 250 * 0.1 = 25
    expect(screen.getByText("$25.00")).toBeInTheDocument();
  });

  test("calculates total correctly with tax", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
        taxRate={0.1}
        showTax={true}
      />
    );

    // Total: 250 + 25 = 275
    expect(screen.getByText("$275.00")).toBeInTheDocument();
  });

  test("displays item count correctly", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    // Total items: 2 + 1 = 3
    expect(screen.getByText("(3 items)")).toBeInTheDocument();
  });

  test("calls onUpdateQuantity when quantity is changed", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    const inputs = screen.getAllByRole("spinbutton");
    const firstInput = inputs[0];

    fireEvent.change(firstInput, { target: { value: "5" } });

    expect(mockHandlers.onUpdateQuantity).toHaveBeenCalledWith("1", 5);
  });

  test("calls onRemoveItem when remove button is clicked", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    const removeButtons = screen.getAllByRole("button", { name: "" });
    // X button is the last button in each cart item row
    const firstRemoveButton = removeButtons.find((btn) =>
      btn.querySelector("svg.lucide-x")
    );

    if (firstRemoveButton) {
      fireEvent.click(firstRemoveButton);
      expect(mockHandlers.onRemoveItem).toHaveBeenCalled();
    }
  });

  test("calls onClearCart when Clear All is clicked", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    const clearButton = screen.getByText("Clear All");
    fireEvent.click(clearButton);

    expect(mockHandlers.onClearCart).toHaveBeenCalled();
  });

  test("disables plus button when quantity reaches stock limit", () => {
    const limitedStockItem = [
      {
        id: "1",
        sku: "SKU-001",
        name: "Limited Stock Product",
        price: 100,
        quantity: 5,
        stock: 5,
      },
    ];

    render(
      <CartManager
        items={limitedStockItem}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    // Plus button should be disabled when quantity === stock
    const buttons = screen.getAllByRole("button");
    const plusButton = buttons.find((btn) =>
      btn.querySelector("svg.lucide-plus")
    );

    expect(plusButton).toBeDisabled();
  });

  test("shows max stock warning when at stock limit", () => {
    const limitedStockItem = [
      {
        id: "1",
        sku: "SKU-001",
        name: "Limited Stock Product",
        price: 100,
        quantity: 5,
        stock: 5,
      },
    ];

    render(
      <CartManager
        items={limitedStockItem}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
      />
    );

    expect(screen.getByText("Max stock reached")).toBeInTheDocument();
  });

  test("does not show tax section when showTax is false", () => {
    render(
      <CartManager
        items={mockItems}
        onUpdateQuantity={mockHandlers.onUpdateQuantity}
        onRemoveItem={mockHandlers.onRemoveItem}
        onClearCart={mockHandlers.onClearCart}
        showTax={false}
      />
    );

    expect(screen.queryByText(/tax/i)).not.toBeInTheDocument();
  });
});
