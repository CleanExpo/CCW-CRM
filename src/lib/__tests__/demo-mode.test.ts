/**
 * UNI-2116: Tests for the demo-mode gate utility.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDemoMode } from '../demo-mode';

describe('isDemoMode', () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalEnv;
    }
  });

  it('returns false when NEXT_PUBLIC_DEMO_MODE is unset', () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    expect(isDemoMode()).toBe(false);
  });

  it('returns false when NEXT_PUBLIC_DEMO_MODE=false', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    expect(isDemoMode()).toBe(false);
  });

  it('returns false when NEXT_PUBLIC_DEMO_MODE is empty string', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = '';
    expect(isDemoMode()).toBe(false);
  });

  it('returns true only when NEXT_PUBLIC_DEMO_MODE=true', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    expect(isDemoMode()).toBe(true);
  });
});
