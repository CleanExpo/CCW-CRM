# Marketing landing page (`/`)

The public home route is implemented in `src/components/landing/marketing-landing.tsx` and composed from smaller landing components.

- **SEO:** `src/lib/metadata/home-page.ts` — metadata consumed by `src/app/page.tsx`.
- **Stats:** Server fetch in `page.tsx` calls `BACKEND_URL/api/public/stats`; when unavailable, a neutral placeholder explains the live KPI strip.
