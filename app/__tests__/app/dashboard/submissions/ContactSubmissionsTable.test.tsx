import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { ContactSubmissionsTable } from "@/app/(dashboard)/submissions/components/ContactSubmissionsTable";
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

describe("ContactSubmissionsTable", () => {
  const mockSubmissions = {
    items: [
      {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: "555-1234",
        subject: "Product Inquiry",
        message: "I'm interested in your products",
        source: "walk-in",
        status: "new",
        created_at: "2026-01-13T10:00:00Z",
        updated_at: "2026-01-13T10:00:00Z",
      },
      {
        id: "2",
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "555-5678",
        subject: null,
        message: "Need help with order",
        source: "internet",
        status: "read",
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
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue(mockSubmissions);
  });

  test("renders table with submissions", async () => {
    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });
  });

  test("displays email addresses", async () => {
    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    });
  });

  test("displays source for each submission", async () => {
    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      const sources = screen.getAllByText(/walk-in|internet/i);
      expect(sources.length).toBeGreaterThan(0);
    });
  });

  test("displays status badges", async () => {
    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText("new")).toBeInTheDocument();
      expect(screen.getByText("read")).toBeInTheDocument();
    });
  });

  test("allows status updates", async () => {
    vi.spyOn(apiClient.apiClient, "patch").mockResolvedValue({});

    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Find and click the first status dropdown
    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.click(statusSelects[0]);

    await waitFor(() => {
      const readOption = screen.getByRole("option", { name: /read/i });
      fireEvent.click(readOption);
    });

    await waitFor(() => {
      expect(apiClient.apiClient.patch).toHaveBeenCalledWith(
        "/api/contact-submissions/1/status",
        { status: "read" }
      );
    });
  });

  test("shows loading state initially", () => {
    render(<ContactSubmissionsTable />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("shows empty state when no submissions", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    });

    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText(/no contact submissions yet/i)).toBeInTheDocument();
    });
  });

  test("handles pagination", async () => {
    // Mock data with multiple pages to trigger pagination UI
    vi.spyOn(apiClient.apiClient, "get").mockResolvedValue({
      ...mockSubmissions,
      total: 25,
      total_pages: 3,
    });

    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Check if pagination controls are displayed
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  test("allows filtering by status", async () => {
    render(<ContactSubmissionsTable statusFilter="new" />);

    await waitFor(() => {
      expect(apiClient.apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("status_filter=new")
      );
    });
  });

  test("allows searching submissions", async () => {
    render(<ContactSubmissionsTable searchQuery="John" />);

    await waitFor(() => {
      expect(apiClient.apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("search=John")
      );
    });
  });

  test("handles API error gracefully", async () => {
    vi.spyOn(apiClient.apiClient, "get").mockRejectedValue(new Error("Network error"));

    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  test("refreshes data when onDataChange is called", async () => {
    const mockOnDataChange = vi.fn();

    render(<ContactSubmissionsTable onDataChange={mockOnDataChange} />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Status update should trigger onDataChange
    vi.spyOn(apiClient.apiClient, "patch").mockResolvedValue({});

    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.click(statusSelects[0]);

    await waitFor(() => {
      const readOption = screen.getByRole("option", { name: /read/i });
      fireEvent.click(readOption);
    });

    await waitFor(() => {
      expect(mockOnDataChange).toHaveBeenCalled();
    });
  });

  test("displays date in readable format", async () => {
    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getAllByText("Jan 13, 2026").length).toBeGreaterThan(0);
    });
  });


  test("handles status update error", async () => {
    vi.spyOn(apiClient.apiClient, "patch").mockRejectedValue(new Error("Update failed"));

    render(<ContactSubmissionsTable />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Try to update status
    const statusSelects = screen.getAllByRole("combobox");
    fireEvent.click(statusSelects[0]);

    await waitFor(() => {
      const readOption = screen.getByRole("option", { name: /read/i });
      fireEvent.click(readOption);
    });

    // Should still show the submissions (no crash)
    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });
});
