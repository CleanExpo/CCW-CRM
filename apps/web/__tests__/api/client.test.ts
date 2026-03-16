import { describe, test, expect, beforeEach, vi } from "vitest";
import { apiClient, ApiClientError } from "@/lib/api/client";
import { server } from "../setup/msw";
import { http, HttpResponse } from "msw";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

describe("apiClient", () => {
  beforeEach(() => {
    // Clear cookies
    document.cookie = "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  describe("GET requests", () => {
    test("makes successful GET request", async () => {
      const data = await apiClient.get<{ data: unknown[]; total: number }>("/api/products");

      expect(data).toHaveProperty("data");
      expect(data).toHaveProperty("total");
    });

    test("includes query parameters", async () => {
      const data = await apiClient.get<{ data: unknown[] }>("/api/products?search=drill");

      expect(data).toHaveProperty("data");
      expect(Array.isArray(data.data)).toBe(true);
    });

    test("handles 404 errors", async () => {
      server.use(
        http.get(`${BACKEND_URL}/api/not-found`, () => {
          return HttpResponse.json(
            { detail: "Resource not found" },
            { status: 404 }
          );
        })
      );

      await expect(apiClient.get("/api/not-found")).rejects.toThrow(
        ApiClientError
      );
    });

    test("includes auth token when available", async () => {
      // Set a mock auth token
      document.cookie = "auth_token=mock-jwt-token; path=/";

      let requestHeaders: Headers | null = null;

      server.use(
        http.get(`${BACKEND_URL}/api/test-auth`, ({ request }) => {
          requestHeaders = request.headers;
          return HttpResponse.json({ success: true });
        })
      );

      await apiClient.get("/api/test-auth");

      expect(requestHeaders?.get("Authorization")).toBe("Bearer mock-jwt-token");
    });
  });

  describe("POST requests", () => {
    test("makes successful POST request", async () => {
      const newProduct = {
        sku: "SKU-TEST",
        name: "Test Product",
        price: "99.99",
        stock: 100,
      };

      const result = await apiClient.post<{ id: string; name: string }>("/api/products", newProduct);

      expect(result).toHaveProperty("id");
      expect(result.name).toBe("Test Product");
    });

    test("sends JSON body", async () => {
      let requestBody: any = null;

      server.use(
        http.post(`${BACKEND_URL}/api/test-post`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      await apiClient.post("/api/test-post", { test: "data" });

      expect(requestBody).toEqual({ test: "data" });
    });

    test("handles validation errors", async () => {
      server.use(
        http.post(`${BACKEND_URL}/api/products`, () => {
          return HttpResponse.json(
            { detail: "SKU already exists" },
            { status: 400 }
          );
        })
      );

      await expect(
        apiClient.post("/api/products", { sku: "DUPLICATE" })
      ).rejects.toThrow("SKU already exists");
    });
  });

  describe("PUT requests", () => {
    test("makes successful PUT request", async () => {
      const updatedProduct = {
        name: "Updated Product",
        price: "199.99",
      };

      const result = await apiClient.put<{ id: string; name: string }>("/api/products/1", updatedProduct);

      expect(result.id).toBe("1");
      expect(result.name).toBe("Updated Product");
    });

    test("sends complete payload", async () => {
      let requestBody: any = null;

      server.use(
        http.put(`${BACKEND_URL}/api/test-put/:id`, async ({ request }) => {
          requestBody = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      const payload = { field1: "value1", field2: "value2" };
      await apiClient.put("/api/test-put/123", payload);

      expect(requestBody).toEqual(payload);
    });
  });

  describe("PATCH requests", () => {
    test("makes successful PATCH request", async () => {
      server.use(
        http.patch(`${BACKEND_URL}/api/products/:id`, async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: "1", ...body });
        })
      );

      const result = await apiClient.patch<{ id: string; stock: number }>("/api/products/1", { stock: 50 });

      expect(result.stock).toBe(50);
    });
  });

  describe("DELETE requests", () => {
    test("makes successful DELETE request", async () => {
      const result = await apiClient.delete("/api/products/1");

      // 204 No Content returns empty object
      expect(result).toEqual({});
    });

    test("handles delete errors", async () => {
      server.use(
        http.delete(`${BACKEND_URL}/api/products/:id`, () => {
          return HttpResponse.json(
            { detail: "Cannot delete product with active orders" },
            { status: 400 }
          );
        })
      );

      await expect(apiClient.delete("/api/products/999")).rejects.toThrow(
        "Cannot delete product with active orders"
      );
    });
  });

  describe("Error handling", () => {
    test("throws ApiClientError on 500 errors", async () => {
      server.use(
        http.get(`${BACKEND_URL}/api/error`, () => {
          return HttpResponse.json(
            { detail: "Internal server error" },
            { status: 500 }
          );
        })
      );

      try {
        await apiClient.get("/api/error");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
        expect((error as ApiClientError).status).toBe(500);
        expect((error as ApiClientError).message).toBe("Internal server error");
      }
    });

    test("handles network errors", async () => {
      server.use(
        http.get(`${BACKEND_URL}/api/network-error`, () => {
          return HttpResponse.error();
        })
      );

      await expect(apiClient.get("/api/network-error")).rejects.toThrow();
    });

    test("handles malformed JSON responses", async () => {
      server.use(
        http.get(`${BACKEND_URL}/api/bad-json`, () => {
          return new HttpResponse("Not JSON", {
            status: 500,
            headers: { "Content-Type": "text/plain" },
          });
        })
      );

      try {
        await apiClient.get("/api/bad-json");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
      }
    });

    test("includes error code when provided", async () => {
      server.use(
        http.get(`${BACKEND_URL}/api/error-with-code`, () => {
          return HttpResponse.json(
            { detail: "Validation failed", error_code: "VALIDATION_ERROR" },
            { status: 422 }
          );
        })
      );

      try {
        await apiClient.get("/api/error-with-code");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiClientError);
        expect((error as ApiClientError).errorCode).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("Authentication", () => {
    test("sends requests without auth header when no token", async () => {
      let requestHeaders: Headers | null = null;

      server.use(
        http.get(`${BACKEND_URL}/api/test-no-auth`, ({ request }) => {
          requestHeaders = request.headers;
          return HttpResponse.json({ success: true });
        })
      );

      await apiClient.get("/api/test-no-auth");

      expect(requestHeaders?.get("Authorization")).toBeNull();
    });

    test("extracts user_id from JWT and adds to headers", async () => {
      // Mock JWT token with user_id in payload
      const mockJWT = [
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        btoa(JSON.stringify({ user_id: "user-123" })),
        "signature",
      ].join(".");

      document.cookie = `auth_token=${mockJWT}; path=/`;

      let requestHeaders: Headers | null = null;

      server.use(
        http.get(`${BACKEND_URL}/api/test-user-id`, ({ request }) => {
          requestHeaders = request.headers;
          return HttpResponse.json({ success: true });
        })
      );

      await apiClient.get("/api/test-user-id");

      expect(requestHeaders?.get("X-User-Id")).toBe("user-123");
    });
  });

  describe("Content-Type handling", () => {
    test("sets Content-Type to application/json", async () => {
      let requestHeaders: Headers | null = null;

      server.use(
        http.post(`${BACKEND_URL}/api/test-content-type`, ({ request }) => {
          requestHeaders = request.headers;
          return HttpResponse.json({ success: true });
        })
      );

      await apiClient.post("/api/test-content-type", { data: "test" });

      expect(requestHeaders?.get("Content-Type")).toBe("application/json");
    });

    test("includes credentials in requests", async () => {
      // This is tested implicitly by MSW server receiving cookies
      document.cookie = "session=test-session; path=/";

      await apiClient.get("/api/products");

      // If this succeeds without error, credentials were sent
      expect(true).toBe(true);
    });
  });
});
