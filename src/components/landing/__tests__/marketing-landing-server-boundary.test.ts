import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = process.cwd();

describe('homepage marketing landing Flight boundary', () => {
  it('is a server module so webpack Flight does not lazy-load it as undefined', async () => {
    const src = await readFile(
      path.join(REPO_ROOT, 'src/components/landing/marketing-landing.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/^['"]use client['"]\s*;?/);
    expect(src).toContain('export default function MarketingLanding');
  });

  it('homepage imports the landing default and streams stats as a server child', async () => {
    const src = await readFile(path.join(REPO_ROOT, 'src/app/page.tsx'), 'utf8');
    expect(src).toContain("import MarketingLanding from '@/components/landing/marketing-landing'");
    expect(src).toContain('statsSlot=');
    expect(src).toContain('<HomeStats />');
  });

  it('interactive islands keep a default export for the server landing to import', async () => {
    const files = [
      'src/components/landing/hero-operations-stage.tsx',
      'src/components/landing/landing-faq.tsx',
      'src/components/landing/marketing-ambient.tsx',
      'src/components/landing/marketing-login-panel.tsx',
      'src/components/landing/marketing-reveal.tsx',
      'src/components/landing/landing-operations-pulse.tsx',
    ];
    for (const file of files) {
      const src = await readFile(path.join(REPO_ROOT, file), 'utf8');
      expect(src, file).toMatch(/^['"]use client['"]/);
      expect(src, file).toMatch(/export default /);
    }
  });
});
