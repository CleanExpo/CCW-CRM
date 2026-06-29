import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildXeroRedirectUriForOrigin,
  listXeroRegisteredRedirectUris,
  normalizeXeroRedirectUri,
  resolveXeroRedirectUri,
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

  it('resolves localhost when XERO_REDIRECT_URI_LOCAL matches request origin', () => {
    const prevLocal = process.env.XERO_REDIRECT_URI_LOCAL;
    const prevPrimary = process.env.XERO_REDIRECT_URI;
    process.env.XERO_REDIRECT_URI_LOCAL =
      'http://localhost:3000/api/integrations/xero/callback';
    process.env.XERO_REDIRECT_URI =
      'https://ccwonline.com.au/api/integrations/xero/callback';

    const request = new NextRequest('http://localhost:3000/dashboard/settings/integrations');
    expect(resolveXeroRedirectUri(request)).toBe(
      'http://localhost:3000/api/integrations/xero/callback'
    );

    process.env.XERO_REDIRECT_URI_LOCAL = prevLocal;
    process.env.XERO_REDIRECT_URI = prevPrimary;
  });

  it('resolves production when request origin matches XERO_REDIRECT_URI', () => {
    const prevLocal = process.env.XERO_REDIRECT_URI_LOCAL;
    const prevPrimary = process.env.XERO_REDIRECT_URI;
    process.env.XERO_REDIRECT_URI_LOCAL =
      'http://localhost:3000/api/integrations/xero/callback';
    process.env.XERO_REDIRECT_URI =
      'https://ccwonline.com.au/api/integrations/xero/callback';

    const request = new NextRequest('https://ccwonline.com.au/dashboard/settings/integrations');
    expect(resolveXeroRedirectUri(request)).toBe(
      'https://ccwonline.com.au/api/integrations/xero/callback'
    );

    process.env.XERO_REDIRECT_URI_LOCAL = prevLocal;
    process.env.XERO_REDIRECT_URI = prevPrimary;
  });

  it('lists both env redirect URIs for operator diagnostics', () => {
    const prevLocal = process.env.XERO_REDIRECT_URI_LOCAL;
    const prevPrimary = process.env.XERO_REDIRECT_URI;
    process.env.XERO_REDIRECT_URI_LOCAL =
      'http://localhost:3000/api/integrations/xero/callback';
    process.env.XERO_REDIRECT_URI =
      'https://ccwonline.com.au/api/integrations/xero/callback';

    expect(listXeroRegisteredRedirectUris()).toEqual([
      'https://ccwonline.com.au/api/integrations/xero/callback',
      'http://localhost:3000/api/integrations/xero/callback',
    ]);

    process.env.XERO_REDIRECT_URI_LOCAL = prevLocal;
    process.env.XERO_REDIRECT_URI = prevPrimary;
  });
});
