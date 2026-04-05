/**
 * Tests for calculation utilities.
 */

import { describe, test, expect } from "vitest";
import {
  calculateLineTotal,
  calculateUnitPrice,
  calculateTotals,
  calculateMargin,
  validatePriceVsCost,
  formatCurrency,
  parseCurrency,
} from "./calculations";

describe("calculateLineTotal", () => {
  test("basic calculation", () => {
    const result = calculateLineTotal(5, 10.0);
    expect(result).toBe(50.0);
  });

  test("with decimal unit price", () => {
    const result = calculateLineTotal(5, 10.5);
    expect(result).toBe(52.5);
  });

  test("zero quantity", () => {
    const result = calculateLineTotal(0, 10.0);
    expect(result).toBe(0.0);
  });

  test("zero unit price", () => {
    const result = calculateLineTotal(5, 0.0);
    expect(result).toBe(0.0);
  });

  test("proper rounding", () => {
    const result = calculateLineTotal(3, 10.333333);
    expect(result).toBe(31.0); // 30.999999 rounds to 31.0
  });

  test("negative quantity throws error", () => {
    expect(() => calculateLineTotal(-1, 10.0)).toThrow(
      "Quantity and unit price must be >= 0"
    );
  });

  test("negative unit price throws error", () => {
    expect(() => calculateLineTotal(5, -10.0)).toThrow(
      "Quantity and unit price must be >= 0"
    );
  });
});

describe("calculateUnitPrice", () => {
  test("basic calculation", () => {
    const result = calculateUnitPrice(100.0, 5);
    expect(result).toBe(20.0);
  });

  test("with decimal result", () => {
    const result = calculateUnitPrice(100.0, 3);
    expect(result).toBe(33.33);
  });

  test("rounding up", () => {
    const result = calculateUnitPrice(100.0, 6);
    expect(result).toBe(16.67); // 16.666... rounds to 16.67
  });

  test("zero quantity throws error", () => {
    expect(() => calculateUnitPrice(100.0, 0)).toThrow(
      "Quantity must be > 0 for division"
    );
  });

  test("negative quantity throws error", () => {
    expect(() => calculateUnitPrice(100.0, -5)).toThrow(
      "Quantity must be > 0 for division"
    );
  });

  test("negative line total throws error", () => {
    expect(() => calculateUnitPrice(-100.0, 5)).toThrow(
      "Line total must be >= 0"
    );
  });

  test("zero line total", () => {
    const result = calculateUnitPrice(0.0, 5);
    expect(result).toBe(0.0);
  });
});

describe("calculateTotals", () => {
  test("basic totals with tax", () => {
    const items = [
      { quantity: 5, unitPrice: 10.0 }, // 50.00
      { quantity: 3, unitPrice: 20.0 }, // 60.00
    ];
    const result = calculateTotals(items, 0.1, true);

    expect(result.subtotal).toBe(110.0);
    expect(result.tax).toBe(11.0);
    expect(result.total).toBe(121.0);
  });

  test("totals without tax", () => {
    const items = [{ quantity: 5, unitPrice: 10.0 }];
    const result = calculateTotals(items, 0.1, false);

    expect(result.subtotal).toBe(50.0);
    expect(result.tax).toBe(0.0);
    expect(result.total).toBe(50.0);
  });

  test("empty items list", () => {
    const result = calculateTotals([], 0.1);

    expect(result.subtotal).toBe(0.0);
    expect(result.tax).toBe(0.0);
    expect(result.total).toBe(0.0);
  });

  test("multiple items", () => {
    const items = [
      { quantity: 2, unitPrice: 25.0 }, // 50.00
      { quantity: 1, unitPrice: 100.0 }, // 100.00
      { quantity: 10, unitPrice: 5.0 }, // 50.00
    ];
    const result = calculateTotals(items, 0.1);

    expect(result.subtotal).toBe(200.0);
    expect(result.tax).toBe(20.0);
    expect(result.total).toBe(220.0);
  });

  test("different tax rate", () => {
    const items = [{ quantity: 1, unitPrice: 100.0 }];
    const result = calculateTotals(items, 0.15); // 15% tax

    expect(result.subtotal).toBe(100.0);
    expect(result.tax).toBe(15.0);
    expect(result.total).toBe(115.0);
  });

  test("zero tax rate", () => {
    const items = [{ quantity: 1, unitPrice: 100.0 }];
    const result = calculateTotals(items, 0.0);

    expect(result.subtotal).toBe(100.0);
    expect(result.tax).toBe(0.0);
    expect(result.total).toBe(100.0);
  });

  test("negative tax rate throws error", () => {
    const items = [{ quantity: 1, unitPrice: 100.0 }];
    expect(() => calculateTotals(items, -0.1)).toThrow("Tax rate must be >= 0");
  });

  test("tax rounding", () => {
    const items = [{ quantity: 1, unitPrice: 33.33 }];
    const result = calculateTotals(items, 0.1);

    expect(result.subtotal).toBe(33.33);
    expect(result.tax).toBe(3.33); // 3.333 rounds to 3.33
    expect(result.total).toBe(36.66);
  });
});

describe("calculateMargin", () => {
  test("basic margin", () => {
    const result = calculateMargin(100.0, 75.0);

    expect(result.marginAmount).toBe(25.0);
    expect(result.marginPercentage).toBe(25.0);
  });

  test("50 percent margin", () => {
    const result = calculateMargin(100.0, 50.0);

    expect(result.marginAmount).toBe(50.0);
    expect(result.marginPercentage).toBe(50.0);
  });

  test("zero margin", () => {
    const result = calculateMargin(100.0, 100.0);

    expect(result.marginAmount).toBe(0.0);
    expect(result.marginPercentage).toBe(0.0);
  });

  test("zero cost", () => {
    const result = calculateMargin(100.0, 0.0);

    expect(result.marginAmount).toBe(100.0);
    expect(result.marginPercentage).toBe(100.0);
  });

  test("margin rounding", () => {
    const result = calculateMargin(100.0, 66.67);

    expect(result.marginAmount).toBe(33.33);
    expect(result.marginPercentage).toBe(33.33);
  });

  test("zero price throws error", () => {
    expect(() => calculateMargin(0.0, 50.0)).toThrow("Price must be > 0");
  });

  test("negative price throws error", () => {
    expect(() => calculateMargin(-100.0, 50.0)).toThrow("Price must be > 0");
  });

  test("negative cost throws error", () => {
    expect(() => calculateMargin(100.0, -50.0)).toThrow("Cost must be >= 0");
  });

  test("cost exceeds price throws error", () => {
    expect(() => calculateMargin(100.0, 150.0)).toThrow(
      "Cost cannot exceed price"
    );
  });
});

describe("validatePriceVsCost", () => {
  test("price greater than cost", () => {
    const result = validatePriceVsCost(100.0, 75.0);
    expect(result).toBe(true);
  });

  test("price equals cost", () => {
    const result = validatePriceVsCost(100.0, 100.0);
    expect(result).toBe(true);
  });

  test("price less than cost", () => {
    const result = validatePriceVsCost(75.0, 100.0);
    expect(result).toBe(false);
  });

  test("null cost", () => {
    const result = validatePriceVsCost(100.0, null);
    expect(result).toBe(true);
  });

  test("undefined cost", () => {
    const result = validatePriceVsCost(100.0, undefined);
    expect(result).toBe(true);
  });

  test("zero cost", () => {
    const result = validatePriceVsCost(100.0, 0.0);
    expect(result).toBe(true);
  });
});

describe("formatCurrency", () => {
  test("basic formatting", () => {
    const result = formatCurrency(1234.56);
    expect(result).toBe("$1,234.56");
  });

  test("zero value", () => {
    const result = formatCurrency(0);
    expect(result).toBe("$0.00");
  });

  test("large value", () => {
    const result = formatCurrency(1234567.89);
    expect(result).toBe("$1,234,567.89");
  });

  test("rounds to 2 decimal places", () => {
    const result = formatCurrency(123.456);
    expect(result).toBe("$123.46"); // Rounds up
  });

  test("negative value", () => {
    const result = formatCurrency(-100.0);
    expect(result).toBe("-$100.00");
  });
});

describe("parseCurrency", () => {
  test("parse formatted currency", () => {
    const result = parseCurrency("$1,234.56");
    expect(result).toBe(1234.56);
  });

  test("parse plain number", () => {
    const result = parseCurrency("1234.56");
    expect(result).toBe(1234.56);
  });

  test("parse with spaces", () => {
    const result = parseCurrency("$ 1 234.56");
    expect(result).toBe(1234.56);
  });

  test("invalid string returns zero", () => {
    const result = parseCurrency("invalid");
    expect(result).toBe(0);
  });

  test("empty string returns zero", () => {
    const result = parseCurrency("");
    expect(result).toBe(0);
  });

  test("negative value", () => {
    const result = parseCurrency("-$100.00");
    expect(result).toBe(-100.0);
  });
});
