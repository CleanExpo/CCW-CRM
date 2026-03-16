import { render, RenderOptions } from "@testing-library/react";
import { ReactElement, ReactNode } from "react";
import { vi } from "vitest";

/**
 * Mock Next.js Router
 */
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  pathname: "/",
  query: {},
  asPath: "/",
};

/**
 * Mock useRouter hook
 */
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Mock toast notifications
 */
export const mockToast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToast,
    error: mockToast,
    info: mockToast,
    warning: mockToast,
  },
}));

/**
 * Mock framer-motion to avoid animation issues in tests
 */
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/**
 * Custom render function with providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  // Add custom options here if needed
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  return render(ui, { ...options });
}

// Re-export everything
export * from "@testing-library/react";
export { customRender as render };

/**
 * Helper to wait for all promises to resolve
 */
export const flushPromises = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Helper to create mock API responses
 */
export function createMockApiResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

/**
 * Helper to create mock API error
 */
export function createMockApiError(message: string, status = 500) {
  return {
    ok: false,
    status,
    json: async () => ({ detail: message }),
    text: async () => JSON.stringify({ detail: message }),
  } as Response;
}
