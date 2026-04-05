---
name: page-transitions
category: design
version: 1.0.0
description: Smooth page transitions and route loading indicators for premium user experience
author: CCW ERP Team
priority: 3
auto-load: false
triggers:
  - page transition
  - route animation
  - navigation animation
  - loading indicator
  - page loading
requires:
  - design/design-system.skill.md
  - frontend/nextjs.skill.md
---

# Page Transitions Skill

## Overview

Premium page transitions create a polished, app-like feel that reduces perceived loading times and provides visual continuity during navigation. This skill teaches agents how to implement smooth page transitions in Next.js 15 applications.

## Core Principles

1. **Smooth Transitions**: Use spring physics for natural motion
2. **Visual Feedback**: Always show loading states
3. **Performance**: Transitions should never slow down navigation
4. **Consistency**: Use same transition patterns throughout app
5. **Accessibility**: Respect prefers-reduced-motion user preference

## Component Patterns

### 1. PageTransition Component

**Location**: `components/transitions/PageTransition.tsx`

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

const variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const, // Custom easing (ease-smooth)
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="hidden"
        animate="enter"
        exit="exit"
        variants={variants}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Key Features**:

- Uses `pathname` as key to trigger animation on route change
- `mode="wait"` ensures exit animation completes before enter
- Small y offset (10px) for subtle slide effect
- Shorter exit (0.2s) than enter (0.3s) for snappier feel
- `as const` assertion for TypeScript type safety with ease arrays

### 2. RouteProgressBar Component

**Location**: `components/transitions/RouteProgressBar.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export function RouteProgressBar() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="from-primary via-primary/80 to-primary fixed top-0 right-0 left-0 z-[100] h-1 origin-left bg-gradient-to-r"
          style={{ boxShadow: '0 0 10px hsl(var(--primary))' }}
        />
      )}
    </AnimatePresence>
  );
}
```

**Key Features**:

- Watches pathname changes to trigger loading state
- Fixed positioning at top of viewport (z-index 100)
- Gradient for visual interest
- Glow shadow for prominence
- `origin-left` makes scaleX animation start from left
- Auto-dismisses after 300ms

### 3. FadeIn Component (Reusable)

**Location**: `components/transitions/FadeIn.tsx`

```tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 0.5, className }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1] as const,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

**Use Cases**:

- Staggered content reveals
- Dashboard sections loading in sequence
- Form fields appearing progressively

### 4. StaggerChildren Component

**Location**: `components/transitions/StaggerChildren.tsx`

```tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const childVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

export function StaggerChildren({ children, className, staggerDelay = 0.1 }: StaggerChildrenProps) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

// Wrapper for individual staggered items
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={childVariants} className={className}>
      {children}
    </motion.div>
  );
}
```

**Usage Example**:

```tsx
<StaggerChildren className="grid gap-4 md:grid-cols-3">
  <StaggerItem>
    <Card>Metric 1</Card>
  </StaggerItem>
  <StaggerItem>
    <Card>Metric 2</Card>
  </StaggerItem>
  <StaggerItem>
    <Card>Metric 3</Card>
  </StaggerItem>
</StaggerChildren>
```

## Integration Points

### Root Layout

**File**: `app/layout.tsx`

```tsx
import { RouteProgressBar } from '@/components/transitions/RouteProgressBar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RouteProgressBar /> {/* Global loading indicator */}
        {children}
      </body>
    </html>
  );
}
```

### Dashboard Layout

**File**: `app/(dashboard)/layout.tsx`

```tsx
import { PageTransition } from '@/components/transitions/PageTransition';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">
        <PageTransition>{children}</PageTransition> {/* Wrap page content */}
      </main>
    </div>
  );
}
```

### Dashboard Page

**File**: `app/(dashboard)/dashboard/page.tsx`

```tsx
import { StaggerChildren, StaggerItem } from '@/components/transitions/StaggerChildren';
import { FadeIn } from '@/components/transitions/FadeIn';

export default function DashboardPage() {
  return (
    <>
      {/* Metrics cards with stagger */}
      <StaggerChildren className="mb-6 grid gap-4 md:grid-cols-3">
        <StaggerItem>
          <Card>Revenue</Card>
        </StaggerItem>
        <StaggerItem>
          <Card>Orders</Card>
        </StaggerItem>
        <StaggerItem>
          <Card>Products</Card>
        </StaggerItem>
      </StaggerChildren>

      {/* Charts with delayed fade-in */}
      <FadeIn delay={0.5}>
        <div className="grid gap-4 md:grid-cols-2">
          <RevenueChart />
          <CategorySalesChart />
        </div>
      </FadeIn>
    </>
  );
}
```

## Animation Timing Guidelines

### Duration

- **Quick**: 0.15-0.2s - Button hovers, icon changes
- **Normal**: 0.3s - Page transitions, card reveals
- **Slow**: 0.5-0.8s - Large layout changes

### Easing Functions

- **ease-smooth**: `[0.4, 0, 0.2, 1]` - Standard transitions (most common)
- **ease-out-expo**: `[0.16, 1, 0.3, 1]` - Dramatic entrances
- **ease-spring**: Use `type: "spring"` with `stiffness: 300-500, damping: 20-30`

### Stagger Delays

- **Cards/Grid Items**: 0.05-0.1s
- **List Items**: 0.03-0.05s
- **Sections**: 0.2-0.3s

## Performance Considerations

### 1. Use CSS Transforms

Always animate `opacity`, `scale`, `x`, `y` (transforms) rather than `width`, `height`, `top`, `left`:

```tsx
// ✅ Good - GPU accelerated
<motion.div animate={{ opacity: 1, y: 0 }} />

// ❌ Bad - Triggers layout reflow
<motion.div animate={{ height: 100, top: 0 }} />
```

### 2. Respect Reduced Motion

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const variants = {
  hidden: { opacity: prefersReducedMotion ? 1 : 0 },
  enter: {
    opacity: 1,
    y: prefersReducedMotion ? 0 : 10,
    transition: { duration: prefersReducedMotion ? 0 : 0.3 },
  },
};
```

### 3. Lazy Load Framer Motion

Only load animations on client side:

```tsx
'use client'; // Required for framer-motion

import { motion } from 'framer-motion';
```

## TypeScript Considerations

### Ease Array Type Safety

Always use `as const` assertion for ease arrays:

```tsx
// ✅ Correct
ease: [0.4, 0, 0.2, 1] as const,

// ❌ Type error - inferred as number[]
ease: [0.4, 0, 0.2, 1],
```

### Variants Type Safety

Export and reuse variant objects for type safety:

```tsx
export const fadeInVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
  },
} as const;
```

## Testing

### Visual Testing Checklist

- [ ] Transition triggers on route change
- [ ] No flicker or layout shift during transition
- [ ] Loading bar appears at top of viewport
- [ ] Staggered items reveal in sequence
- [ ] Animations respect reduced-motion preference
- [ ] No performance drops (60fps maintained)
- [ ] Works on mobile devices

### Performance Testing

```bash
# Check bundle size impact
pnpm analyze

# Framer Motion adds ~40KB gzipped
# Acceptable for premium UX
```

## Common Pitfalls

### 1. Forgetting AnimatePresence

```tsx
// ❌ Exit animation won't work
<motion.div exit={{ opacity: 0 }}>...</motion.div>

// ✅ Correct
<AnimatePresence>
  <motion.div exit={{ opacity: 0 }}>...</motion.div>
</AnimatePresence>
```

### 2. Missing Key Prop

```tsx
// ❌ Won't re-trigger on route change
<motion.div variants={variants}>{children}</motion.div>

// ✅ Correct
<motion.div key={pathname} variants={variants}>{children}</motion.div>
```

### 3. Z-Index Issues

Loading bar should be above all content:

```tsx
className = 'fixed ... z-[100]'; // High z-index for loading bar
```

## Australian Context

- All animations respect Australian cultural expectations (professional, not flashy)
- Loading messages use Australian English spelling
- Timing tuned for average Australian internet speeds (fast transitions for good UX)

## Dependencies

```json
{
  "framer-motion": "^11.0.0"
}
```

Install via:

```bash
pnpm add framer-motion
```

## References

- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Next.js 15 App Router](https://nextjs.org/docs/app)
- [Material Design Motion](https://material.io/design/motion)
- [WCAG 2.1 - Animation](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
