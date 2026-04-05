# Design Skills

Premium design patterns for creating modern, responsive, and interactive user interfaces.

## Available Skills

### 1. Page Transitions (`page-transitions.skill.md`)

**Priority**: 3
**Triggers**: page transition, route animation, navigation animation

Smooth page transitions and route loading indicators for premium user experience. Includes:

- PageTransition component with fade/slide animations
- RouteProgressBar for loading feedback
- FadeIn and StaggerChildren patterns
- Spring physics guidelines

### 2. Responsive Tables (`responsive-tables.skill.md`)

**Priority**: 3
**Triggers**: responsive table, mobile table, data table

Mobile-responsive table patterns that transform into card layouts on small screens. Includes:

- ResponsiveTable generic component with TypeScript
- Desktop table → Mobile card automatic switching
- Selective column hiding for mobile
- Real-world examples (Products, Orders, Customers)

### 3. Micro-Interactions (`micro-interactions.skill.md`)

**Priority**: 3
**Triggers**: micro-interaction, hover effect, animation

Premium micro-interactions and hover effects for polished user experience. Includes:

- ButtonEnhanced with spring animations
- AnimatedIcon wrapper
- PulseNotification for badges
- RippleButton Material Design effect
- ShakeOnError and SuccessCheckmark
- CSS utility classes for common effects

## When to Use

Load these skills when working on:

- Frontend UI components
- Dashboard pages
- Data tables or lists
- Navigation components
- Interactive elements
- Mobile-responsive layouts

## Dependencies

All skills require:

```bash
pnpm add framer-motion
```

And shadcn/ui components (already installed in project).

## Integration

These skills build on:

- `design-system.skill.md` - Design tokens and guidelines
- `frontend/nextjs.skill.md` - Next.js 15 patterns

## Testing

All patterns include:

- Visual testing checklists
- Performance considerations
- Accessibility requirements
- Common pitfalls to avoid

## Australian Context

All implementations follow:

- Australian English spelling
- DD/MM/YYYY date formatting
- AUD currency formatting
- Professional (not flashy) animation style
