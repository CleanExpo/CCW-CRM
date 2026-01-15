/**
 * CSV Export Utilities
 * Provides functions to export data to CSV format
 */

/**
 * Convert an array of objects to CSV format
 */
export function convertToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) return "";

  // Create header row
  const headerRow = headers.join(",");

  // Create data rows
  const dataRows = data.map((item) => {
    return headers
      .map((header) => {
        const value = item[header];
        // Handle values that contain commas or quotes
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Export products to CSV
 */
export function exportProductsToCSV(products: any[]): void {
  const headers = [
    "sku",
    "name",
    "category",
    "price",
    "cost",
    "stock",
    "warehouse_location",
    "is_active",
  ];

  const data = products.map((product) => ({
    sku: product.sku,
    name: product.name,
    category: product.category,
    price: product.price,
    cost: product.cost || "",
    stock: product.stock,
    warehouse_location: product.warehouse_location || "",
    is_active: product.is_active ? "Yes" : "No",
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `products-export-${timestamp}.csv`);
}

/**
 * Export customers to CSV
 */
export function exportCustomersToCSV(customers: any[]): void {
  const headers = [
    "customer_number",
    "company_name",
    "contact_name",
    "email",
    "phone",
    "address",
    "city",
    "state",
    "postal_code",
    "country",
    "is_active",
  ];

  const data = customers.map((customer) => ({
    customer_number: customer.customer_number,
    company_name: customer.company_name,
    contact_name: customer.contact_name || "",
    email: customer.email || "",
    phone: customer.phone || "",
    address: customer.address || "",
    city: customer.city || "",
    state: customer.state || "",
    postal_code: customer.postal_code || customer.postcode || "",
    country: customer.country || "Australia",
    is_active: customer.is_active ? "Yes" : "No",
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `customers-export-${timestamp}.csv`);
}

/**
 * Export orders to CSV
 */
export function exportOrdersToCSV(orders: any[]): void {
  const headers = [
    "order_number",
    "customer_name",
    "order_date",
    "status",
    "total",
    "item_count",
    "notes",
  ];

  const data = orders.map((order) => ({
    order_number: order.order_number,
    customer_name: order.customer_name || "",
    order_date: new Date(order.order_date).toLocaleDateString(),
    status: order.status,
    total: order.total,
    item_count: order.item_count || order.items?.length || 0,
    notes: order.notes || "",
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `orders-export-${timestamp}.csv`);
}

/**
 * Export quotes to CSV
 */
export function exportQuotesToCSV(quotes: any[]): void {
  const headers = [
    "quote_number",
    "customer_name",
    "quote_date",
    "valid_until",
    "status",
    "total",
    "item_count",
    "notes",
  ];

  const data = quotes.map((quote) => ({
    quote_number: quote.quote_number,
    customer_name: quote.customer_name || "",
    quote_date: new Date(quote.quote_date).toLocaleDateString(),
    valid_until: new Date(quote.valid_until).toLocaleDateString(),
    status: quote.status,
    total: quote.total,
    item_count: quote.item_count || quote.items?.length || 0,
    notes: quote.notes || "",
  }));

  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `quotes-export-${timestamp}.csv`);
}
