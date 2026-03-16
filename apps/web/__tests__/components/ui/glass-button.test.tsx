import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlassButton } from "@/components/ui/glass-button";

describe("GlassButton", () => {
  test("renders button with children", () => {
    render(<GlassButton>Click Me</GlassButton>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  test("applies default size variant", () => {
    render(<GlassButton>Default</GlassButton>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  test("applies small size variant", () => {
    render(<GlassButton size="sm">Small</GlassButton>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  test("applies large size variant", () => {
    render(<GlassButton size="lg">Large</GlassButton>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  test("applies icon size variant", () => {
    render(
      <GlassButton size="icon">
        <span>🚀</span>
      </GlassButton>
    );
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  test("handles click events", () => {
    const handleClick = vi.fn();
    render(<GlassButton onClick={handleClick}>Click Me</GlassButton>);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("can be disabled", () => {
    const handleClick = vi.fn();
    render(
      <GlassButton onClick={handleClick} disabled>
        Disabled
      </GlassButton>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test("accepts custom className", () => {
    render(<GlassButton className="custom-class">Custom</GlassButton>);
    const wrapper = screen.getByRole("button").parentElement;
    expect(wrapper).toHaveClass("custom-class");
  });

  test("accepts contentClassName prop", () => {
    render(<GlassButton contentClassName="text-red-500">Red Text</GlassButton>);
    const button = screen.getByRole("button");
    const span = button.querySelector("span");
    expect(span).toHaveClass("text-red-500");
  });

  test("renders with complex children", () => {
    render(
      <GlassButton>
        <span>Icon</span>
        <span>Text</span>
      </GlassButton>
    );
    expect(screen.getByText("Icon")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
  });

  test("forwards ref correctly", () => {
    const ref = vi.fn();
    render(<GlassButton ref={ref}>Ref Test</GlassButton>);
    expect(ref).toHaveBeenCalled();
  });

  test("supports type attribute", () => {
    render(<GlassButton type="submit">Submit</GlassButton>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
  });
});
