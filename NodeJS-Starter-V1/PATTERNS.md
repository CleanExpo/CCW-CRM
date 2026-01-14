# Code Patterns Reference

**Project**: CCW-Online-ERP
**Purpose**: Reusable code patterns and examples for common development tasks

---

## Table of Contents

1. [Frontend Form Component Pattern](#frontend-form-component-pattern)
2. [API Client Usage Patterns](#api-client-usage-patterns)
3. [Backend Endpoint Patterns](#backend-endpoint-patterns)
4. [Delete Confirmation Pattern](#delete-confirmation-pattern)
5. [Testing Patterns](#testing-patterns)
6. [Data Refresh Patterns](#data-refresh-patterns)
7. [Error Handling Patterns](#error-handling-patterns)

---

## Frontend Form Component Pattern

### Full Example: Create/Edit Form Component

**Location**: `apps/web/app/(dashboard)/[module]/components/[ModuleName]Form.tsx`

**Reference Implementation**: `apps/web/components/auth/login-form.tsx`

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

// Step 1: Define Zod validation schema
const formSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  price: z.number().positive("Price must be positive"),
  cost: z.number().optional(),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  warehouse_location: z.string().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

// Step 2: Define component props with TypeScript
interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: FormData & { id?: string };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProductForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Step 3: Initialize React Hook Form with Zod resolver
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      sku: "",
      name: "",
      description: "",
      category: "",
      price: 0,
      cost: 0,
      stock: 0,
      warehouse_location: "",
      is_active: true,
    },
  });

  // Step 4: Submit handler with loading state and error handling
  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      if (mode === "create") {
        await apiClient.post("/api/products", values);
        toast({
          title: "Success",
          description: "Product created successfully",
        });
      } else {
        await apiClient.put(`/api/products/${initialData?.id}`, values);
        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      }
      onSuccess?.();
      router.refresh(); // Refresh server components to show new data
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Operation failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Step 5: Render form with shadcn/ui components
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Text Input Field */}
        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU</FormLabel>
              <FormControl>
                <Input placeholder="Enter SKU" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Text Input Field */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter product name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Textarea Field */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter product description"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Select Field */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="heavy_machinery">Heavy Machinery</SelectItem>
                  <SelectItem value="hand_tools">Hand Tools</SelectItem>
                  <SelectItem value="power_tools">Power Tools</SelectItem>
                  <SelectItem value="safety_equipment">Safety Equipment</SelectItem>
                  <SelectItem value="building_materials">Building Materials</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="accessories">Accessories</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Number Input Field */}
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Number Input Field */}
        <FormField
          control={form.control}
          name="stock"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stock</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Saving..."
              : mode === "create"
              ? "Create Product"
              : "Update Product"}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
```

### Key Points

1. **Always use Zod for validation** - Define schema first, infer TypeScript types
2. **Use React Hook Form** - Handles form state, validation, and submission
3. **Loading states required** - Set `isLoading` during async operations
4. **Disable button during submission** - Prevents duplicate submissions
5. **Toast notifications** - Show success/error messages to user
6. **Router.refresh()** - Refresh server components after mutations
7. **TypeScript types** - Define prop interfaces, use type inference

---

## API Client Usage Patterns

### Configuration

**Location**: `apps/web/lib/api/client.ts`

The `apiClient` automatically handles:
- JWT token from cookies
- JSON serialization/deserialization
- Base URL from environment variable
- Error responses

### GET Request

```typescript
import { apiClient } from "@/lib/api/client";

// Simple GET
const products = await apiClient.get<Product[]>("/api/products");

// GET with query parameters
const response = await apiClient.get<PaginatedResponse>("/api/products", {
  params: {
    page: 1,
    page_size: 50,
    search: "drill",
    category: "power_tools",
  },
});

// Or with URL parameters
const filteredProducts = await apiClient.get<PaginatedResponse>(
  "/api/products?page=1&page_size=50&search=drill&category=power_tools"
);
```

### POST Request (Create)

```typescript
import { apiClient } from "@/lib/api/client";

const newProduct = await apiClient.post<Product>("/api/products", {
  sku: "SKU-001",
  name: "Cordless Drill",
  description: "20V cordless drill with battery",
  category: "power_tools",
  price: 149.99,
  cost: 85.00,
  stock: 50,
  warehouse_location: "Section A-12",
  is_active: true,
});
```

### PUT Request (Update)

```typescript
import { apiClient } from "@/lib/api/client";

const updatedProduct = await apiClient.put<Product>(
  `/api/products/${productId}`,
  {
    name: "Updated Product Name",
    price: 199.99,
    stock: 25,
  }
);
```

### DELETE Request

```typescript
import { apiClient } from "@/lib/api/client";

await apiClient.delete(`/api/products/${productId}`);

// Handle response if needed
const response = await apiClient.delete<{ message: string; id: string }>(
  `/api/products/${productId}`
);
console.log(response.message); // "Product deleted successfully"
```

### Error Handling

```typescript
import { apiClient } from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/client";

try {
  const product = await apiClient.get<Product>(`/api/products/${id}`);
} catch (error) {
  if (error instanceof ApiClientError) {
    // Structured API error
    console.error("Status:", error.status);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
  } else {
    // Network or other error
    console.error("Unexpected error:", error);
  }
}
```

### TypeScript Response Types

```typescript
// Define response interfaces
interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  // ... other fields
}

interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Use with generic types
const response = await apiClient.get<PaginatedResponse<Product>>("/api/products");
response.items.forEach((product) => {
  console.log(product.name); // TypeScript knows this is a string
});
```

---

## Backend Endpoint Patterns

### List Endpoint with Pagination and Filters

**Location**: `apps/backend/src/api/routes/[module].py`

```python
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from src.config.database import get_db
from src.db.erp_models import Product
from src.db.schemas import Product as ProductSchema, PaginatedResponse

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("", response_model=PaginatedResponse)
async def list_products(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    category: str | None = None,
):
    """List products with pagination and filters."""
    # Build query
    query = select(Product)

    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                Product.name.ilike(search_filter),
                Product.sku.ilike(search_filter),
            )
        )

    # Apply category filter
    if category:
        query = query.where(Product.category == category)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination and ordering
    query = query.order_by(Product.name).limit(page_size).offset((page - 1) * page_size)

    # Execute query
    result = await db.execute(query)
    products = result.scalars().all()

    # Return paginated response
    return {
        "items": [ProductSchema.model_validate(p) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }
```

### Get Single Record Endpoint

```python
from fastapi import HTTPException

@router.get("/{product_id}", response_model=ProductSchema)
async def get_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single product by ID."""
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return ProductSchema.model_validate(product)
```

### Create Endpoint

```python
from src.db.schemas import ProductCreate

@router.post("", response_model=ProductSchema, status_code=201)
async def create_product(
    product_data: ProductCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new product."""
    # Create SQLAlchemy model instance
    product = Product(**product_data.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)

    return ProductSchema.model_validate(product)
```

### Update Endpoint

```python
from src.db.schemas import ProductUpdate

@router.put("/{product_id}", response_model=ProductSchema)
async def update_product(
    product_id: UUID,
    product_data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing product."""
    # Get existing product
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update only provided fields
    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)

    return ProductSchema.model_validate(product)
```

### Delete Endpoint

```python
@router.delete("/{product_id}")
async def delete_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a product."""
    # Get existing product
    result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Delete product
    await db.delete(product)
    await db.commit()

    return {
        "message": "Product deleted successfully",
        "product_id": str(product_id),
    }
```

---

## Delete Confirmation Pattern

### AlertDialog Component

**Always use confirmation dialogs for destructive actions**

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DeleteProductDialogProps {
  productId: string;
  productName: string;
  onDeleteSuccess?: () => void;
}

export function DeleteProductDialog({
  productId,
  productName,
  onDeleteSuccess,
}: DeleteProductDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/products/${productId}`);
      toast({
        title: "Success",
        description: `${productName} has been deleted`,
      });
      onDeleteSuccess?.();
      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete{" "}
            <span className="font-semibold">{productName}</span> and remove all
            associated data from the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Usage in Table Actions

```typescript
<TableCell>
  <div className="flex gap-2">
    <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
      Edit
    </Button>
    <DeleteProductDialog
      productId={product.id}
      productName={product.name}
      onDeleteSuccess={() => {
        // Optionally handle success
        console.log("Product deleted");
      }}
    />
  </div>
</TableCell>
```

---

## Testing Patterns

### Frontend Component Testing (Vitest + Testing Library)

**Location**: `apps/web/__tests__/components/[module]/[Component].test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { ProductForm } from "@/app/(dashboard)/products/components/ProductForm";

// Mock API client
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("ProductForm", () => {
  test("shows validation error for empty SKU", async () => {
    render(<ProductForm mode="create" />);

    const submitButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/sku is required/i)).toBeInTheDocument();
    });
  });

  test("shows validation error for negative stock", async () => {
    render(<ProductForm mode="create" />);

    const stockInput = screen.getByLabelText(/stock/i);
    fireEvent.change(stockInput, { target: { value: "-5" } });

    const submitButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/stock cannot be negative/i)).toBeInTheDocument();
    });
  });

  test("creates product successfully", async () => {
    const { apiClient } = await import("@/lib/api/client");
    (apiClient.post as any).mockResolvedValue({ id: "123", sku: "TEST-001" });

    render(<ProductForm mode="create" />);

    // Fill in form fields
    fireEvent.change(screen.getByLabelText(/sku/i), {
      target: { value: "TEST-001" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Test Product" },
    });
    fireEvent.change(screen.getByLabelText(/price/i), {
      target: { value: "99.99" },
    });

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/api/products", expect.any(Object));
    });
  });

  test("disables submit button during submission", async () => {
    render(<ProductForm mode="create" />);

    const submitButton = screen.getByRole("button", { name: /create/i });
    fireEvent.click(submitButton);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });
});
```

### Backend Endpoint Testing (Pytest)

**Location**: `apps/backend/tests/api/test_products.py`

```python
import pytest
from httpx import AsyncClient
from uuid import uuid4

@pytest.mark.asyncio
async def test_list_products(async_client: AsyncClient):
    """Test listing products with pagination."""
    response = await async_client.get("/api/products?page=1&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_get_product_not_found(async_client: AsyncClient):
    """Test getting non-existent product returns 404."""
    fake_id = str(uuid4())
    response = await async_client.get(f"/api/products/{fake_id}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"


@pytest.mark.asyncio
async def test_create_product(async_client: AsyncClient):
    """Test creating a new product."""
    product_data = {
        "sku": "TEST-001",
        "name": "Test Product",
        "category": "hand_tools",
        "price": 99.99,
        "stock": 50,
    }

    response = await async_client.post("/api/products", json=product_data)

    assert response.status_code == 201
    data = response.json()
    assert data["sku"] == "TEST-001"
    assert data["name"] == "Test Product"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_product_duplicate_sku(async_client: AsyncClient, db_session):
    """Test creating product with duplicate SKU fails."""
    # Create first product
    product1 = {
        "sku": "DUP-001",
        "name": "First Product",
        "category": "hand_tools",
        "price": 99.99,
    }
    await async_client.post("/api/products", json=product1)

    # Try to create duplicate
    product2 = {
        "sku": "DUP-001",  # Same SKU
        "name": "Second Product",
        "category": "power_tools",
        "price": 199.99,
    }
    response = await async_client.post("/api/products", json=product2)

    assert response.status_code == 400
    assert "duplicate" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_update_product(async_client: AsyncClient):
    """Test updating an existing product."""
    # Create product first
    create_response = await async_client.post(
        "/api/products",
        json={
            "sku": "UPD-001",
            "name": "Original Name",
            "category": "hand_tools",
            "price": 99.99,
        },
    )
    product_id = create_response.json()["id"]

    # Update product
    update_response = await async_client.put(
        f"/api/products/{product_id}",
        json={"name": "Updated Name", "price": 149.99},
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "Updated Name"
    assert data["price"] == 149.99


@pytest.mark.asyncio
async def test_delete_product(async_client: AsyncClient):
    """Test deleting a product."""
    # Create product first
    create_response = await async_client.post(
        "/api/products",
        json={
            "sku": "DEL-001",
            "name": "To Delete",
            "category": "hand_tools",
            "price": 99.99,
        },
    )
    product_id = create_response.json()["id"]

    # Delete product
    delete_response = await async_client.delete(f"/api/products/{product_id}")
    assert delete_response.status_code == 200

    # Verify product is gone
    get_response = await async_client.get(f"/api/products/{product_id}")
    assert get_response.status_code == 404
```

---

## Data Refresh Patterns

### After Mutations (Create/Update/Delete)

```typescript
import { useRouter } from "next/navigation";

function MyComponent() {
  const router = useRouter();

  async function handleCreate(data: FormData) {
    await apiClient.post("/api/products", data);
    router.refresh(); // Refresh server components
  }

  async function handleUpdate(id: string, data: FormData) {
    await apiClient.put(`/api/products/${id}`, data);
    router.refresh(); // Refresh server components
  }

  async function handleDelete(id: string) {
    await apiClient.delete(`/api/products/${id}`);
    router.refresh(); // Refresh server components
  }
}
```

### Manual Re-fetch with SWR (if using client-side fetching)

```typescript
import useSWR, { mutate } from "swr";

function MyComponent() {
  const { data, error } = useSWR("/api/products", (url) =>
    apiClient.get(url)
  );

  async function handleCreate(data: FormData) {
    await apiClient.post("/api/products", data);
    // Revalidate SWR cache
    mutate("/api/products");
  }
}
```

---

## Error Handling Patterns

### Consistent Error Display

```typescript
import { useToast } from "@/hooks/use-toast";

function MyComponent() {
  const { toast } = useToast();

  async function handleOperation() {
    try {
      await apiClient.post("/api/products", data);
      toast({
        title: "Success",
        description: "Operation completed successfully",
      });
    } catch (error: any) {
      // Extract user-friendly message
      const message =
        error.message ||
        error.response?.data?.detail ||
        "An unexpected error occurred. Please try again.";

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  }
}
```

### Form Validation Errors

```typescript
// Backend returns validation errors
{
  "detail": [
    {
      "loc": ["body", "price"],
      "msg": "ensure this value is greater than 0",
      "type": "value_error.number.not_gt"
    }
  ]
}

// Frontend handles validation errors
try {
  await apiClient.post("/api/products", data);
} catch (error: any) {
  if (error.status === 422) {
    // Validation error from Pydantic
    const validationErrors = error.details;
    validationErrors.forEach((err: any) => {
      const field = err.loc[err.loc.length - 1];
      form.setError(field, { message: err.msg });
    });
  } else {
    toast({
      title: "Error",
      description: error.message || "Operation failed",
      variant: "destructive",
    });
  }
}
```

---

## Key Principles

1. **Always use loading states** - Prevents duplicate submissions
2. **Always show feedback** - Toast notifications for success/error
3. **Always refresh data** - Use `router.refresh()` after mutations
4. **Always confirm deletes** - Use AlertDialog for destructive actions
5. **Always handle errors** - Try-catch with user-friendly messages
6. **Always type everything** - Use TypeScript interfaces and Zod schemas
7. **Always test critical paths** - Form submission, API calls, delete confirmations

---

*Last Updated: January 14, 2026*
*For database schema, see [SCHEMA.md](SCHEMA.md)*
*For troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)*
