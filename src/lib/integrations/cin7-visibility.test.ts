import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addVisibilityCounts,
  classifyProductVisibility,
  getCin7VisibilityConfig,
  tallyProductVisibility,
  type Cin7VisibilityConfig,
} from './cin7-visibility';

describe('getCin7VisibilityConfig (UNI-2259)', () => {
  beforeEach(() => {
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_FIELD', '');
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_SECURE_VALUES', '');
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_PUBLIC_VALUES', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns null (feature off) when the field env is unset or blank', () => {
    expect(getCin7VisibilityConfig()).toBeNull();
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_FIELD', '   ');
    expect(getCin7VisibilityConfig()).toBeNull();
  });

  it('parses the field and comma-separated value lists (trimmed, lowercased, empties dropped)', () => {
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_FIELD', 'Status');
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_SECURE_VALUES', ' Secure Internal , HIDDEN ,, ');
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_PUBLIC_VALUES', 'Show Public');
    expect(getCin7VisibilityConfig()).toEqual({
      field: 'Status',
      secureValues: ['secure internal', 'hidden'],
      publicValues: ['show public'],
    });
  });

  it('enables with only a secure list (public list optional)', () => {
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_FIELD', 'Status');
    vi.stubEnv('CIN7_PRODUCT_VISIBILITY_SECURE_VALUES', 'secure');
    expect(getCin7VisibilityConfig()).toEqual({
      field: 'Status',
      secureValues: ['secure'],
      publicValues: [],
    });
  });
});

describe('classifyProductVisibility (UNI-2259)', () => {
  const cfg = (over?: Partial<Cin7VisibilityConfig>): Cin7VisibilityConfig => ({
    field: 'Status',
    secureValues: ['secure internal'],
    publicValues: [],
    ...over,
  });

  it('classifies secure values case-insensitively', () => {
    expect(classifyProductVisibility({ Status: 'SECURE INTERNAL' }, cfg())).toBe('secure_internal');
    expect(classifyProductVisibility({ Status: '  secure internal  ' }, cfg())).toBe(
      'secure_internal'
    );
  });

  it('defaults any non-secure, non-empty value to show_public when no public list is set (binary split)', () => {
    expect(classifyProductVisibility({ Status: 'Show Public' }, cfg())).toBe('show_public');
    expect(classifyProductVisibility({ Status: 'anything-else' }, cfg())).toBe('show_public');
  });

  it('requires membership in the public list when one is configured', () => {
    const c = cfg({ publicValues: ['show public'] });
    expect(classifyProductVisibility({ Status: 'Show Public' }, c)).toBe('show_public');
    expect(classifyProductVisibility({ Status: 'archived' }, c)).toBe('unknown');
  });

  it('secure list takes precedence even when a public list is also configured', () => {
    const c = cfg({ secureValues: ['secure internal'], publicValues: ['show public'] });
    expect(classifyProductVisibility({ Status: 'Secure Internal' }, c)).toBe('secure_internal');
    // ...and a value in both lists is secure, never public
    const both = cfg({ secureValues: ['x'], publicValues: ['x'] });
    expect(classifyProductVisibility({ Status: 'x' }, both)).toBe('secure_internal');
  });

  it('treats non-primitive field values (objects, arrays, functions) as unknown, not public', () => {
    expect(classifyProductVisibility({ Status: { nested: true } }, cfg())).toBe('unknown');
    expect(classifyProductVisibility({ Status: ['secure internal'] }, cfg())).toBe('unknown');
    expect(classifyProductVisibility({ Status: () => 'x' }, cfg())).toBe('unknown');
  });

  it('ignores prototype-inherited properties (misconfigured field like "toString") — unknown, not public', () => {
    expect(classifyProductVisibility({}, cfg({ field: 'toString' }))).toBe('unknown');
    expect(classifyProductVisibility({ Status: 'irrelevant' }, cfg({ field: 'constructor' }))).toBe(
      'unknown'
    );
  });

  it('returns unknown when the field is missing, null, or empty', () => {
    expect(classifyProductVisibility({}, cfg())).toBe('unknown');
    expect(classifyProductVisibility({ Status: null }, cfg())).toBe('unknown');
    expect(classifyProductVisibility({ Status: '   ' }, cfg())).toBe('unknown');
  });

  it('stringifies non-string raw values (e.g. booleans) before matching', () => {
    const c = cfg({ secureValues: ['true'] });
    expect(classifyProductVisibility({ Status: true }, c)).toBe('secure_internal');
    expect(classifyProductVisibility({ Status: false }, c)).toBe('show_public');
  });
});

describe('tallyProductVisibility + addVisibilityCounts (UNI-2259)', () => {
  const config: Cin7VisibilityConfig = {
    field: 'Status',
    secureValues: ['secure internal'],
    publicValues: [],
  };

  it('tallies a page of raw rows into per-visibility counts', () => {
    const counts = tallyProductVisibility(
      [
        { Status: 'Secure Internal' },
        { Status: 'Show Public' },
        { Status: 'Show Public' },
        { NoStatusField: 1 },
      ],
      config
    );
    expect(counts).toEqual({ secure_internal: 1, show_public: 2, unknown: 1 });
  });

  it('accumulates page tallies (mirrors the route aggregation)', () => {
    const total = { secure_internal: 1, show_public: 2, unknown: 0 };
    addVisibilityCounts(total, { secure_internal: 0, show_public: 3, unknown: 2 });
    expect(total).toEqual({ secure_internal: 1, show_public: 5, unknown: 2 });
  });
});
