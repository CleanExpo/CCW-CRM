import { describe, expect, it } from 'vitest';
import {
  buildXeroRedirectUriForOrigin,
  normalizeXeroRedirectUri,
  XERO_OAUTH_CALLBACK_PATH,
} from '../xero';

describe('xero redirect helpers', () => {
  it('strips trailing slashes from redirect paths', () => {
    expect(normalizeXeroRedirectUri('https://example.com/callback/')).toBe(
      'https://example.com/callback'
    );
  });

  it('builds callback URI from origin', () => {
    expect(buildXeroRedirectUriForOrigin('http://localhost:3000')).toBe(
      `http://localhost:3000${XERO_OAUTH_CALLBACK_PATH}`
    );
  });
});
