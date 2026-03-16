import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Typewriter } from "@/components/ui/typewriter-text";

describe("Typewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test("renders with empty text initially", () => {
    render(<Typewriter text="Hello" speed={100} />);
    const element = screen.getByText(/\|/); // Cursor should be visible
    expect(element).toBeInTheDocument();
  });

  test("types text character by character", async () => {
    render(<Typewriter text="Hello" speed={50} />);

    // Fast-forward time to allow typing
    vi.advanceTimersByTime(50); // H
    await waitFor(() => expect(screen.getByText(/H/)).toBeInTheDocument());

    vi.advanceTimersByTime(50); // e
    await waitFor(() => expect(screen.getByText(/He/)).toBeInTheDocument());

    vi.advanceTimersByTime(50); // l
    await waitFor(() => expect(screen.getByText(/Hel/)).toBeInTheDocument());

    vi.advanceTimersByTime(50); // l
    await waitFor(() => expect(screen.getByText(/Hell/)).toBeInTheDocument());

    vi.advanceTimersByTime(50); // o
    await waitFor(() => expect(screen.getByText(/Hello/)).toBeInTheDocument());
  });

  test("displays custom cursor", () => {
    render(<Typewriter text="Test" cursor="_" />);
    expect(screen.getByText(/_/)).toBeInTheDocument();
  });

  test("applies custom className", () => {
    const { container } = render(
      <Typewriter text="Test" className="text-red-500" />
    );
    const span = container.querySelector("span.text-red-500");
    expect(span).toBeInTheDocument();
  });

  test("handles array of strings", async () => {
    render(<Typewriter text={["Hello", "World"]} speed={50} loop={false} />);

    // Type "Hello"
    vi.advanceTimersByTime(250); // 5 chars × 50ms
    await waitFor(() => expect(screen.getByText(/Hello/)).toBeInTheDocument());
  });

  test("handles loop mode", async () => {
    render(
      <Typewriter
        text={["First", "Second"]}
        speed={50}
        deleteSpeed={30}
        delay={100}
        loop={true}
      />
    );

    // Type "First"
    vi.advanceTimersByTime(250); // 5 chars × 50ms
    await waitFor(() => expect(screen.getByText(/First/)).toBeInTheDocument());

    // Wait for delay before deletion
    vi.advanceTimersByTime(100);

    // Delete "First" (character by character)
    vi.advanceTimersByTime(150); // 5 chars × 30ms
    await waitFor(() => expect(screen.queryByText("First")).not.toBeInTheDocument());
  });

  test("respects typing speed", async () => {
    render(<Typewriter text="AB" speed={100} />);

    // After 100ms, should have typed "A"
    vi.advanceTimersByTime(100);
    await waitFor(() => expect(screen.getByText(/A/)).toBeInTheDocument());

    // After another 100ms, should have typed "AB"
    vi.advanceTimersByTime(100);
    await waitFor(() => expect(screen.getByText(/AB/)).toBeInTheDocument());
  });

  test("handles empty string gracefully", () => {
    render(<Typewriter text="" />);
    expect(screen.getByText(/\|/)).toBeInTheDocument(); // Only cursor visible
  });

  test("handles empty array gracefully", () => {
    render(<Typewriter text={[]} />);
    expect(screen.getByText(/\|/)).toBeInTheDocument();
  });

  test("shows cursor with animation", () => {
    const { container } = render(<Typewriter text="Test" cursor="|" />);
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });
});
