/**
 * Example usage of MultiLocationStockCell component
 *
 * This file demonstrates how to integrate multi-location stock display
 * into the products page or any other product listing.
 */

import { MultiLocationStockCell, StockByLocation } from "./MultiLocationStockCell";

// Example 1: Product with good stock across all locations
const productWithGoodStock = {
  id: "product-1",
  name: "Heavy Duty Power Drill",
  sku: "SKU-001",
  locations: [
    { location: "brisbane", stock: 50, reserved: 5, available: 45 },
    { location: "sydney", stock: 30, reserved: 3, available: 27 },
    { location: "melbourne", stock: 25, reserved: 2, available: 23 },
  ] as StockByLocation[],
};

// Example 2: Product with low stock warning
const productWithLowStock = {
  id: "product-2",
  name: "Safety Helmet - Yellow",
  sku: "SKU-042",
  locations: [
    { location: "brisbane", stock: 15, reserved: 3, available: 12 },
    { location: "sydney", stock: 8, reserved: 2, available: 6 },
    { location: "melbourne", stock: 5, reserved: 1, available: 4 },
  ] as StockByLocation[],
};

// Example 3: Product out of stock at one location
const productPartialStock = {
  id: "product-3",
  name: "Extension Cord 20m",
  sku: "SKU-105",
  locations: [
    { location: "brisbane", stock: 0, reserved: 0, available: 0 }, // Out of stock
    { location: "sydney", stock: 18, reserved: 5, available: 13 },
    { location: "melbourne", stock: 22, reserved: 0, available: 22 },
  ] as StockByLocation[],
};

// Example 4: Product completely out of stock
const productOutOfStock = {
  id: "product-4",
  name: "Industrial Ladder 3m",
  sku: "SKU-201",
  locations: [
    { location: "brisbane", stock: 0, reserved: 0, available: 0 },
    { location: "sydney", stock: 0, reserved: 0, available: 0 },
    { location: "melbourne", stock: 0, reserved: 0, available: 0 },
  ] as StockByLocation[],
};

/**
 * Example of integrating into a table
 */
export function ProductsTableExample() {
  const products = [
    productWithGoodStock,
    productWithLowStock,
    productPartialStock,
    productOutOfStock,
  ];

  return (
    <div className="w-full">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3">Product</th>
            <th className="text-left p-3">SKU</th>
            <th className="text-left p-3">Stock by Location</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b hover:bg-gray-50">
              <td className="p-3">{product.name}</td>
              <td className="p-3 font-mono text-sm">{product.sku}</td>
              <td className="p-3">
                <MultiLocationStockCell
                  productId={product.id}
                  locations={product.locations}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Example of fetching stock data from API
 */
export async function fetchProductWithStock(productId: string) {
  // In a real implementation:
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/inventory/product/${productId}/locations`
  );
  const stockData: StockByLocation[] = await response.json();

  return {
    id: productId,
    name: "Product Name",
    locations: stockData,
  };
}

/**
 * Example of using in a product card
 */
export function ProductCardExample() {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{productWithGoodStock.name}</h3>
        <p className="text-sm text-muted-foreground">{productWithGoodStock.sku}</p>
      </div>

      <div>
        <label className="text-sm font-medium">Availability:</label>
        <div className="mt-2">
          <MultiLocationStockCell
            productId={productWithGoodStock.id}
            locations={productWithGoodStock.locations}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Hover over location badges to see detailed stock breakdown
      </p>
    </div>
  );
}

/**
 * Integration guide for products page:
 *
 * 1. Update the products API call to include stock by location:
 *    ```typescript
 *    const response = await apiClient.get("/api/products?include_stock_locations=true");
 *    ```
 *
 * 2. Modify the product type to include locations:
 *    ```typescript
 *    interface Product {
 *      id: string;
 *      sku: string;
 *      name: string;
 *      price: number;
 *      stock_by_location: StockByLocation[];  // Add this field
 *    }
 *    ```
 *
 * 3. Update the table column definition:
 *    ```typescript
 *    {
 *      key: "stock",
 *      label: "Stock by Location",
 *      render: (product) => (
 *        <MultiLocationStockCell
 *          productId={product.id}
 *          productName={product.name}
 *          locations={product.stock_by_location}
 *        />
 *      ),
 *    }
 *    ```
 *
 * 4. Backend API should return stock data in this format:
 *    ```json
 *    {
 *      "id": "uuid",
 *      "sku": "SKU-001",
 *      "name": "Product Name",
 *      "stock_by_location": [
 *        {
 *          "location": "brisbane",
 *          "quantity": 50,
 *          "reserved": 5,
 *          "available": 45
 *        },
 *        {
 *          "location": "sydney",
 *          "quantity": 30,
 *          "reserved": 3,
 *          "available": 27
 *        },
 *        {
 *          "location": "melbourne",
 *          "quantity": 25,
 *          "reserved": 2,
 *          "available": 23
 *        }
 *      ]
 *    }
 *    ```
 */
