# Frontend AGENTS.md

> Next.js 15 + React 19 + Tailwind v4 + shadcn/ui application

## Package Identity

| Attribute | Value |
|-----------|-------|
| Framework | Next.js 15 (App Router) |
| UI Library | React 19, shadcn/ui (new-york style) |
| Styling | Tailwind CSS v4, CSS Variables |
| State | React hooks, Server Components |

## Setup & Run

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev --filter=web

# Build for production
pnpm build --filter=web

# Type checking
pnpm turbo run type-check --filter=web

# Linting
pnpm turbo run lint --filter=web
```

## File Organization

```
apps/web/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group
│   ├── (dashboard)/       # Dashboard route group
│   ├── api/               # API routes
│   └── design-system/     # Component showcase
├── components/
│   ├── ui/                # Base shadcn/ui components
│   ├── marketing/         # Marketing blocks
│   ├── auth/              # Auth-specific components
│   ├── chat/              # Chat components
│   └── layout/            # Layout components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and services
│   ├── design-system/     # Design tokens, validators
│   └── image-generation/  # AI image generation
└── types/                 # TypeScript types
```

## Patterns & Conventions

### ✅ DO: Component Structure

```tsx
// components/ui/button.tsx - Real example
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, ...props }, ref) => {
    // Implementation
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### ❌ DON'T: Anti-patterns

```tsx
// BAD: No explicit types
const Button = ({ onClick }) => <button onClick={onClick} />

// BAD: Using `any`
const handleData = (data: any) => { ... }

// BAD: Inline styles instead of Tailwind
<div style={{ marginTop: '20px' }} />

// BAD: Raw colors instead of design tokens
<div className="bg-blue-500" />  // Use bg-brand-primary
```

### ✅ DO: API Route Pattern

```tsx
// app/api/example/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Validate input
    // Call service
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### ✅ DO: Custom Hook Pattern

```tsx
// hooks/use-example.ts
export function useExample() {
  const [state, setState] = useState<ExampleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getData();
      setState(data);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { state, loading, error, fetchData };
}
```

## Design System

### Color Tokens
```tsx
// Use semantic colors, not raw values
✅ className="bg-brand-primary text-brand-primary-foreground"
✅ className="bg-success text-success-foreground"
✅ className="bg-surface-elevated"

❌ className="bg-blue-500"
❌ className="bg-[#3b82f6]"
```

### Component Variants
```tsx
// Use CVA variants, see: components/ui/button.tsx
<Button variant="gradient" size="lg">Primary Action</Button>
<Button variant="outline">Secondary</Button>
<Card variant="interactive">Clickable Card</Card>
```

### Motion Utilities
```tsx
// See: components/ui/motion.tsx
import { FadeIn, SlideUp, Stagger } from "@/components/ui/motion";

<FadeIn delay={100}>
  <Content />
</FadeIn>

<Stagger staggerDelay={100}>
  {items.map(item => <FadeIn key={item.id}>{item.name}</FadeIn>)}
</Stagger>
```

## Key Files

| File | Purpose |
|------|---------|
| `app/globals.css` | Design tokens, animations |
| `tailwind.config.ts` | Tailwind configuration |
| `components.json` | shadcn/ui configuration |
| `lib/utils.ts` | `cn()` utility |
| `lib/design-system/config.ts` | Design system settings |
| `lib/design-system/pattern-validator.ts` | QA validation |

## Search Patterns (JIT)

```bash
# Find component definition
rg "export.*function" components/ui/ -l

# Find hook
rg "export function use" hooks/

# Find API route
rg "export async function" app/api/

# Find page component
rg "export default" app/**/page.tsx

# Find design token usage
rg "brand-primary" --type tsx
```

## Common Gotchas

1. **Server vs Client Components**
   - Default is Server Component
   - Add `"use client"` only when needed (hooks, browser APIs)
   - See: `components/ui/motion.tsx` (requires "use client")

2. **Import Aliases**
   - Use `@/` prefix: `import { Button } from "@/components/ui/button"`
   - Defined in `tsconfig.json`

3. **Design System Compliance**
   - Run validator: `import { validateContent } from "@/lib/design-system"`
   - Check for forbidden patterns (raw colors, hardcoded pixels)

4. **Loading States**
   - Every async component needs loading/error/empty states
   - Use `components/ui/loading.tsx` utilities

## Pre-PR Checks

```bash
# Single command - all checks
cd apps/web && pnpm type-check && pnpm lint && pnpm build && echo "✅ Ready"
```

## Adding New Components

1. Check UI library registry: `lib/design-system/library-registry.ts`
2. Prefer sourcing from: StyleUI > KokonutUI > Cult UI > Custom
3. Use CVA for variants: `class-variance-authority`
4. Add to barrel export if applicable
5. Document props with JSDoc or interface

```tsx
// New component template
"use client"; // Only if needed

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const exampleVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "default-styles",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface ExampleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof exampleVariants> {}

const Example = React.forwardRef<HTMLDivElement, ExampleProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(exampleVariants({ variant }), className)} {...props} />
  )
);
Example.displayName = "Example";

export { Example, exampleVariants };
```

---

**Parent**: [Root AGENTS.md](../../AGENTS.md)
