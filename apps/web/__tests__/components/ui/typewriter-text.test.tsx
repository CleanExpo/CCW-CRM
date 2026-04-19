import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Typewriter } from '@/components/ui/typewriter-text';

describe('Typewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('renders with empty text initially', () => {
    render(<Typewriter text="Hello" speed={100} />);
    const element = screen.getByText(/\|/); // Cursor should be visible
    expect(element).toBeInTheDocument();
  });

  test('types text character by character', async () => {
    render(<Typewriter text="Hello" speed={50} />);

    await act(async () => {
      vi.advanceTimersByTime(50);
    }); // H
    expect(screen.getByText(/H/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(50);
    }); // e
    expect(screen.getByText(/He/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(50);
    }); // l
    expect(screen.getByText(/Hel/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(50);
    }); // l
    expect(screen.getByText(/Hell/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(50);
    }); // o
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  test('displays custom cursor', () => {
    render(<Typewriter text="Test" cursor="_" />);
    expect(screen.getByText(/_/)).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<Typewriter text="Test" className="text-red-500" />);
    const span = container.querySelector('span.text-red-500');
    expect(span).toBeInTheDocument();
  });

  test('handles array of strings', async () => {
    render(<Typewriter text={['Hello', 'World']} speed={50} loop={false} />);

    // Advance one timer per character (each fires, then React re-renders + registers next)
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
    }
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  test('handles loop mode', async () => {
    render(
      <Typewriter text={['First', 'Second']} speed={50} deleteSpeed={30} delay={100} loop={true} />
    );

    // Type "First" one char at a time
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
    }
    expect(screen.getByText(/First/)).toBeInTheDocument();

    // Trigger delay then delete one char at a time
    await act(async () => {
      vi.advanceTimersByTime(100);
    }); // fires inner setTimeout → setIsDeleting
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        vi.advanceTimersByTime(30);
      });
    }
    expect(screen.queryByText('First')).not.toBeInTheDocument();
  });

  test('respects typing speed', async () => {
    render(<Typewriter text="AB" speed={100} />);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText(/A/)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText(/AB/)).toBeInTheDocument();
  });

  test('handles empty string gracefully', () => {
    render(<Typewriter text="" />);
    expect(screen.getByText(/\|/)).toBeInTheDocument(); // Only cursor visible
  });

  test('handles empty array gracefully', () => {
    render(<Typewriter text={[]} />);
    expect(screen.getByText(/\|/)).toBeInTheDocument();
  });

  test('shows cursor with animation', () => {
    const { container } = render(<Typewriter text="Test" cursor="|" />);
    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).toBeInTheDocument();
  });
});
