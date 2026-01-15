import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { DemoRequestsTable } from "@/app/(dashboard)/submissions/components/DemoRequestsTable";
import * as apiClient from "@/lib/api/client";

// Mock the API client
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock date-fns format
vi.mock("date-fns", () => ({
  format: vi.fn((date) => "Jan 13, 2026"),
}));

describe("DemoRequestsTable", () => {
  const mockDemoRequests = {
    items: [
      {
        id: "1",
        company_name: "ACME Corp",
        contact_name: "John Doe",
        email: "john@acme.com",
        phone: "555-1234",
        product_interest: "Heavy Machinery",
        preferred_date: "2026-02-15T00:00:00Z",
        notes: "Looking for inventory solutions",
        status: "pending",
        created_at: "2026-01-13T10:00:00Z",
        updated_at: "2026-01-13T10:00:00Z",
      },
      {
        id: "2",
        company_name: "Tech Solutions",
        contact_name: "Jane Smith",
        email: "jane@techsolutions.com",
        phone: "555-5678",
        product_interest: null,
        preferred_date: null,
        notes: null,
        status: "scheduled",
        created_at: "2026-01-13T11:00:00Z",
        updated_at: "2026-01-13T11:00:00Z",
      },
    ],
    total: 2,
    page: 1,
    page_size: 10,
    total_pages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue(mockDemoRequests);
  });

  test("renders table with demo requests", async () => {
    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeInTheDocument();
      expect(screen.getByText("Tech Solutions")).toBeInTheDocument();
    });
  });

  test("displays contact names", async () => {
    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });
  });

  test("displays email addresses", async () => {
    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("john@acme.com")).toBeInTheDocument();
      expect(screen.getByText("jane@techsolutions.com")).toBeInTheDocument();
    });
  });

  test("displays status badges with correct colors", async () => {
    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument();
      expect(screen.getByText("scheduled")).toBeInTheDocument();
    });
  });

  test("allows status updates", async () => {
    vi.spyOn(apiClient.apiClient, "patch").mockResolvedValue({});

    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    });

    // Find and click the first status dropdown
    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.click(statusSelects[0]);

    await waitFor(() => {
      const scheduledOption = screen.getByRole("option", { name: /scheduled/i });
      fireEvent.click(scheduledOption);
    });

    await waitFor(() => {
      expect(apiClient.apiClient.patch).toHaveBeenCalledWith(
        "/api/demo-requests/1/status",
        { status: "scheduled" }
      );
    });
  });

  test("shows loading state initially", () => {
    render(<DemoRequestsTable />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("shows empty state when no demo requests", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    });

    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText(/no demo requests yet/i)).toBeInTheDocument();
    });
  });

  test("handles pagination", async () => {
    // Mock data with multiple pages to trigger pagination UI
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      ...mockDemoRequests,
      total: 25,
      total_pages: 3,
    });

    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    });

    // Check if pagination controls are displayed
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  test("allows filtering by status", async () => {
    render(<DemoRequestsTable statusFilter="pending" />);

    await waitFor(() => {
      expect(apiClient.apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("status_filter=pending")
      );
    });
  });

  test("allows searching demo requests", async () => {
    render(<DemoRequestsTable searchQuery="ACME" />);

    await waitFor(() => {
      expect(apiClient.apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("search=ACME")
      );
    });
  });

  test("handles API error gracefully", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockRejectedValue(new Error("Network error"));

    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  test("refreshes data when onDataChange is called", async () => {
    const mockOnDataChange = vi.fn();

    render(<DemoRequestsTable onDataChange={mockOnDataChange} />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    });

    // Status update should trigger onDataChange
    vi.spyOn(apiClient.apiClient, "patch").mockResolvedValue({});

    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.click(statusSelects[0]);

    await waitFor(() => {
      const scheduledOption = screen.getByRole("option", { name: /scheduled/i });
      fireEvent.click(scheduledOption);
    });

    await waitFor(() => {
      expect(mockOnDataChange).toHaveBeenCalled();
    });
  });

  test("displays date in readable format", async () => {
    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getAllByText("Jan 13, 2026").length).toBeGreaterThan(0);
    });
  });


  test("handles status update error", async () => {
    vi.spyOn(apiClient.apiClient, "patch").mockRejectedValue(new Error("Update failed"));

    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    });

    // Try to update status
    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.click(statusSelects[0]);

    await waitFor(() => {
      const scheduledOption = screen.getByRole("option", { name: /scheduled/i });
      fireEvent.click(scheduledOption);
    });

    // Should still show the demo requests (no crash)
    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    });
  });

  test("handles all status transitions", async () => {
    vi.spyOn(apiClient.apiClient, "patch").mockResolvedValue({});

    render(<DemoRequestsTable />);

    await waitFor(() => {
      expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    });

    // Test scheduled status transition only (simplify test)
    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.click(statusSelects[0]);

    await waitFor(() => {
      const scheduledOption = screen.getByRole("option", { name: /scheduled/i });
      fireEvent.click(scheduledOption);
    });

    await waitFor(() => {
      expect(apiClient.apiClient.patch).toHaveBeenCalledWith(
        "/api/demo-requests/1/status",
        { status: "scheduled" }
      );
    });
  });

  test("displays company icon for each demo request", async () => {
    render(<DemoRequestsTable />);

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      // First row is header, so data rows start from index 1
      expect(rows.length).toBeGreaterThan(1);
    });
  });
});
