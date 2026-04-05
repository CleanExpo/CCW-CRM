---
name: micro-interactions
category: design
version: 1.0.0
description: Premium micro-interactions and hover effects that create a polished, responsive user experience
author: CCW ERP Team
priority: 3
auto-load: false
triggers:
  - micro-interaction
  - hover effect
  - animation
  - interactive
  - button animation
  - icon animation
requires:
  - design/design-system.skill.md
  - frontend/nextjs.skill.md
---

# Micro-Interactions Skill

## Overview

Micro-interactions are small, subtle animations that provide visual feedback and make interfaces feel alive and responsive. This skill teaches agents how to implement premium micro-interactions that enhance UX without overwhelming the user.

## Core Principles

1. **Purposeful**: Every animation serves a UX purpose (feedback, guidance, affordance)
2. **Subtle**: Micro-interactions should enhance, not distract
3. **Responsive**: Immediate feedback (<100ms) for user actions
4. **Natural**: Use spring physics for organic motion
5. **Performant**: GPU-accelerated transforms only

## Animation Types

### 1. Hover Effects

Small transformations that indicate interactivity:

- **Scale**: 1.02-1.05 (buttons), 1.1-1.2 (icons)
- **Lift**: translateY(-2px to -4px) + shadow
- **Rotate**: 5-15 degrees for playfulness

### 2. Click/Tap Effects

Feedback for user actions:

- **Scale down**: 0.95-0.98 on tap
- **Ripple**: Expanding circle from click point
- **Bounce**: Spring back after press

### 3. State Changes

Visual indicators of state:

- **Success**: Green checkmark with scale + rotate
- **Error**: Shake animation (translateX oscillation)
- **Loading**: Spin or pulse

### 4. Attention Grabbers

Draw focus to important elements:

- **Pulse**: Subtle scale oscillation
- **Glow**: Box-shadow expansion
- **Badge pulse**: "You have new notifications"

## Component Library

### 1. ButtonEnhanced

**File**: `components/ui/button-enhanced.tsx`

Extends shadcn/ui Button with spring animations:

```tsx
'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Reuse existing button variants
import { buttonVariants } from '@/components/ui/button';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const ButtonEnhanced = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <motion.div
        whileHover={{ scale: variant === 'ghost' ? 1.05 : 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="inline-flex"
      >
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={disabled || loading}
          {...props}
        >
          {loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="h-4 w-4 rounded-full border-2 border-current border-t-transparent"
              />
              <span className="ml-2">Loading...</span>
            </>
          ) : (
            children
          )}
        </Comp>
      </motion.div>
    );
  }
);
ButtonEnhanced.displayName = 'ButtonEnhanced';

export { ButtonEnhanced };
```

**Usage**:

```tsx
<ButtonEnhanced variant="default" loading={isSubmitting}>
  Submit
</ButtonEnhanced>
```

### 2. AnimatedIcon

**File**: `components/interactions/AnimatedIcon.tsx`

Reusable wrapper for icon animations:

```tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface AnimatedIconProps {
  children: ReactNode;
  className?: string;
  hoverRotate?: number;
  hoverScale?: number;
}

export function AnimatedIcon({
  children,
  className,
  hoverRotate = 0,
  hoverScale = 1.1,
}: AnimatedIconProps) {
  return (
    <motion.span
      className={className}
      whileHover={{
        scale: hoverScale,
        rotate: hoverRotate,
        transition: { type: 'spring', stiffness: 400, damping: 10 },
      }}
      whileTap={{ scale: 0.9 }}
    >
      {children}
    </motion.span>
  );
}
```

**Usage**:

```tsx
<AnimatedIcon hoverRotate={15} hoverScale={1.2}>
  <Settings className="h-5 w-5" />
</AnimatedIcon>
```

### 3. PulseNotification

**File**: `components/interactions/PulseNotification.tsx`

Animated notification indicator (e.g., for unread messages):

```tsx
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PulseNotificationProps {
  show?: boolean;
  count?: number;
  className?: string;
}

export function PulseNotification({ show = true, count, className }: PulseNotificationProps) {
  if (!show) return null;

  return (
    <div className="relative">
      {/* Pulsing ring */}
      <motion.span
        className={cn(
          'bg-destructive absolute top-0 right-0 inline-flex h-3 w-3 rounded-full opacity-75',
          className
        )}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.75, 0, 0.75],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Solid dot */}
      <span
        className={cn(
          'bg-destructive absolute top-0 right-0 inline-flex h-3 w-3 rounded-full',
          className
        )}
      />
      {/* Count badge (optional) */}
      {count !== undefined && count > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-destructive-foreground bg-destructive absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs leading-none font-bold"
        >
          {count > 99 ? '99+' : count}
        </motion.span>
      )}
    </div>
  );
}
```

**Usage**:

```tsx
<div className="relative">
  <Bell className="h-5 w-5" />
  <PulseNotification show={hasUnread} count={unreadCount} />
</div>
```

### 4. RippleButton

**File**: `components/interactions/RippleButton.tsx`

Material Design ripple effect:

```tsx
'use client';

import { motion } from 'framer-motion';
import { useState, MouseEvent } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export function RippleButton({ children, onClick, ...props }: ButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple: Ripple = {
      x,
      y,
      id: Date.now(),
    };

    setRipples((prev) => [...prev, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);

    onClick?.(e);
  };

  return (
    <Button {...props} onClick={handleClick} className="relative overflow-hidden">
      {children}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute rounded-full bg-white"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 20,
            height: 20,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </Button>
  );
}
```

### 5. ShakeOnError

**File**: `components/interactions/ShakeOnError.tsx`

Shake animation for error states:

```tsx
'use client';

import { motion } from 'framer-motion';
import { ReactNode, useEffect, useState } from 'react';

interface ShakeOnErrorProps {
  error: boolean;
  children: ReactNode;
  className?: string;
}

export function ShakeOnError({ error, children, className }: ShakeOnErrorProps) {
  const [key, setKey] = useState(0);

  // Trigger animation when error becomes true
  useEffect(() => {
    if (error) {
      setKey((prev) => prev + 1);
    }
  }, [error]);

  return (
    <motion.div
      key={key}
      animate={
        error
          ? {
              x: [0, -10, 10, -10, 10, 0],
              transition: { duration: 0.4 },
            }
          : {}
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

**Usage**:

```tsx
<ShakeOnError error={hasError}>
  <Input type="password" />
</ShakeOnError>;
{
  hasError && <p className="text-destructive">Incorrect password</p>;
}
```

### 6. SuccessCheckmark

**File**: `components/interactions/SuccessCheckmark.tsx`

Animated checkmark for success states:

```tsx
'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuccessCheckmarkProps {
  show: boolean;
  className?: string;
}

export function SuccessCheckmark({ show, className }: SuccessCheckmarkProps) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={cn(
        'bg-success text-success-foreground inline-flex items-center justify-center rounded-full',
        className
      )}
    >
      <motion.div
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: 'easeInOut', delay: 0.1 }}
      >
        <Check className="h-5 w-5" />
      </motion.div>
    </motion.div>
  );
}
```

## CSS Utility Classes

Add to `globals.css` for common micro-interactions:

```css
/* Enhanced card with hover effect */
.card-interactive {
  transition:
    transform var(--duration-normal) var(--ease-smooth),
    box-shadow var(--duration-normal) var(--ease-smooth),
    border-color var(--duration-normal) var(--ease-smooth);
  cursor: pointer;
}

.card-interactive:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: var(--shadow-xl);
  border-color: hsl(var(--primary) / 0.5);
}

.card-interactive:active {
  transform: translateY(-2px) scale(0.99);
  transition-duration: 50ms;
}

/* Button with ripple effect */
.btn-enhanced {
  position: relative;
  overflow: hidden;
}

.btn-enhanced::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transform: translate(-50%, -50%);
  transition:
    width var(--duration-slow) var(--ease-out-expo),
    height var(--duration-slow) var(--ease-out-expo);
}

.btn-enhanced:hover::before {
  width: 300px;
  height: 300px;
}

/* Badge with hover effect */
.badge-interactive {
  transition: all var(--duration-fast) var(--ease-smooth);
}

.badge-interactive:hover {
  transform: scale(1.05);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
}

/* Input focus enhancement */
input:focus,
textarea:focus,
select:focus {
  transform: scale(1.01);
  transition: transform var(--duration-fast) var(--ease-spring);
}

/* Icon hover effects */
.icon-hover-rotate {
  transition: transform var(--duration-normal) var(--ease-spring);
}

.icon-hover-rotate:hover {
  transform: rotate(15deg) scale(1.1);
}

.icon-hover-scale {
  transition: transform var(--duration-fast) var(--ease-spring);
}

.icon-hover-scale:hover {
  transform: scale(1.2);
}

/* Link with animated underline */
.link-hover-underline {
  position: relative;
  text-decoration: none;
}

.link-hover-underline::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform var(--duration-normal) var(--ease-smooth);
}

.link-hover-underline:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}

/* Pulse animation for notifications */
.pulse-on-hover:hover {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* Glow effect on hover */
.glow-on-hover {
  transition: box-shadow var(--duration-normal) var(--ease-smooth);
}

.glow-on-hover:hover {
  box-shadow: 0 0 20px hsl(var(--primary) / 0.5);
}
```

## Real-World Implementations

### Enhanced Sidebar Navigation

**File**: `components/layout/sidebar.tsx`

```tsx
import { motion } from 'framer-motion';
import { AnimatedIcon } from '@/components/interactions/AnimatedIcon';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-muted/40 w-64 border-r">
      {/* Logo with hover animation */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="group flex items-center gap-2 font-semibold">
          <motion.span
            className="text-xl"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            ⚙️
          </motion.span>
          <span className="from-primary to-primary/60 group-hover:from-primary/80 group-hover:to-primary/40 bg-gradient-to-r bg-clip-text text-transparent transition-all">
            Equipment ERP
          </span>
        </Link>
      </div>

      {/* Navigation items */}
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item, index) => {
          const isActive = pathname === item.href;

          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: index * 0.05,
                type: 'spring',
                stiffness: 300,
                damping: 25,
              }}
            >
              <Link
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105'
                )}
              >
                {/* Active indicator with layoutId for smooth transitions */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="bg-primary-foreground absolute top-0 bottom-0 left-0 w-1 rounded-r-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                {/* Icon with hover rotation */}
                <motion.div
                  whileHover={{
                    scale: 1.2,
                    rotate: isActive ? 0 : 15,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                  <item.icon className="h-4 w-4" />
                </motion.div>

                <span className="relative z-10">{item.name}</span>

                {/* Hover background effect */}
                {!isActive && (
                  <motion.div
                    className="bg-primary/5 absolute inset-0 rounded-lg"
                    initial={{ scale: 0, opacity: 0 }}
                    whileHover={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>
    </aside>
  );
}
```

### Enhanced Mobile Navigation

**File**: `components/layout/mobile-nav.tsx`

```tsx
import { motion, AnimatePresence } from 'framer-motion';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed top-4 left-4 z-50 md:hidden"
        >
          <Button variant="ghost" size="icon">
            <AnimatePresence mode="wait">
              <motion.div
                key={open ? 'close' : 'menu'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.div>
            </AnimatePresence>
          </Button>
        </motion.div>
      </SheetTrigger>
      {/* ... sheet content with staggered animations ... */}
    </Sheet>
  );
}
```

## Spring Physics Guidelines

### Stiffness (Resistance to Change)

| Use Case       | Stiffness | Feel             |
| -------------- | --------- | ---------------- |
| Quick snappy   | 400-500   | Instant response |
| Normal         | 300-400   | Balanced         |
| Smooth flowing | 200-300   | Gentle           |

### Damping (Friction/Bounce)

| Use Case     | Damping | Feel         |
| ------------ | ------- | ------------ |
| Bouncy       | 10-15   | Playful      |
| Balanced     | 20-30   | Professional |
| No overshoot | 40+     | Precise      |

### Examples

```tsx
// Quick snappy button
<motion.button
  whileHover={{ scale: 1.05 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
/>

// Smooth drawer open
<motion.div
  animate={{ x: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
/>

// Playful icon bounce
<motion.span
  whileHover={{ scale: 1.2, rotate: 15 }}
  transition={{ type: "spring", stiffness: 500, damping: 10 }}
/>
```

## Animation Timing Standards

Use CSS variables defined in `globals.css`:

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}
```

**Guidelines**:

- **150ms (Fast)**: Hover states, icon changes, tooltips
- **300ms (Normal)**: Page transitions, cards, modals
- **500ms (Slow)**: Large layout shifts, drawers, overlays

## Performance Best Practices

### 1. GPU Acceleration

Always use transform properties (scale, translate, rotate) instead of layout properties:

```tsx
// ✅ GPU accelerated
transform: translateY(-4px) scale(1.02)

// ❌ Causes reflow
top: -4px; width: 102%
```

### 2. Will-Change Optimization

For frequently animated elements:

```css
.card-interactive {
  will-change: transform;
}
```

### 3. Reduce Motion Preference

Respect user preferences:

```tsx
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div animate={prefersReducedMotion ? {} : { scale: 1.05 }} />;
```

## Testing Checklist

### Visual Testing

- [ ] Hover effects work on desktop
- [ ] Tap effects work on mobile (no hover state stuck)
- [ ] Animations complete fully (no cut-off)
- [ ] No layout shift during animation
- [ ] Spring physics feel natural
- [ ] Loading states display correctly

### Performance Testing

- [ ] 60fps maintained during animations
- [ ] No frame drops on low-end devices
- [ ] Bundle size acceptable (+40KB for framer-motion)
- [ ] Reduced motion preferences respected

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader not confused by animations
- [ ] Touch targets ≥44px

## Common Pitfalls

### 1. Over-Animating

```tsx
// ❌ Too much - overwhelming
<motion.div
  animate={{
    scale: [1, 1.5, 1],
    rotate: [0, 360, 0],
    x: [0, 100, 0],
  }}
/>

// ✅ Subtle and purposeful
<motion.div
  whileHover={{ scale: 1.02, y: -2 }}
/>
```

### 2. Slow Animations

```tsx
// ❌ Too slow - feels sluggish
transition={{ duration: 1 }}

// ✅ Quick and responsive
transition={{ duration: 0.3 }}
```

### 3. Forgetting Loading States

```tsx
// ❌ No feedback during action
<Button onClick={handleSubmit}>Submit</Button>

// ✅ Shows loading state
<ButtonEnhanced loading={isSubmitting} onClick={handleSubmit}>
  Submit
</ButtonEnhanced>
```

## Australian Context

- Animations respect Australian cultural preferences (professional, not flashy)
- Loading messages use Australian English spelling ("Loading..." not "Loading...")
- Success/error states use appropriate Australian tone ("No worries!" vs "All good!")

## Dependencies

```json
{
  "framer-motion": "^11.0.0"
}
```

## References

- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Material Design Motion](https://material.io/design/motion)
- [Laws of UX - Timing](https://lawsofux.com/fittss-law/)
- [Web Animation API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
