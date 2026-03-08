# Implementation Plan: Design System Override Configuration

## Overview

Transform the current default shadcn/ui setup into a comprehensive, brand-aligned design system with:
- Customizable brand tokens (New/Generic base)
- Full Gemini image generation integration
- Hybrid Tailwind v4 approach (config + @theme)
- Integration patterns for all primary UI libraries

---

## Phase 1: Foundation - Design Token System

### 1.1 Update `globals.css` with Extended Design Tokens

**File:** `apps/web/app/globals.css`

**Changes:**
- Add brand color tokens (primary, secondary, accent with full scale)
- Add semantic color tokens (success, warning, error, info)
- Add surface tokens (elevated, recessed, overlay)
- Add gradient tokens
- Add shadow tokens (sm, md, lg, xl)
- Add animation timing tokens
- Add spacing scale extensions

**New Tokens Structure:**
```css
:root {
  /* Brand Colors - Customizable */
  --brand-primary: 221.2 83.2% 53.3%;
  --brand-primary-50: 214 100% 97%;
  --brand-primary-100: 214 95% 93%;
  /* ... full scale 50-950 */

  /* Semantic Colors */
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --error: 0 84% 60%;
  --info: 199 89% 48%;

  /* Surface Colors */
  --surface-elevated: 0 0% 100%;
  --surface-recessed: 0 0% 97%;
  --surface-overlay: 0 0% 100% / 0.9;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  /* ... extended shadows */

  /* Animation */
  --ease-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
}
```

### 1.2 Extend `tailwind.config.ts`

**File:** `apps/web/tailwind.config.ts`

**Changes:**
- Add brand color mappings
- Add semantic color utilities
- Add custom animations (fade-in, slide-up, scale-in, etc.)
- Add custom keyframes
- Add extended spacing scale
- Add custom font families placeholder

---

## Phase 2: Component Enhancement System

### 2.1 Create Enhanced Button Variants

**File:** `apps/web/components/ui/button.tsx`

**Enhancements:**
- Add `gradient` variant (brand gradient)
- Add `glow` variant (with shadow glow effect)
- Add loading state with spinner
- Add pressed/active state
- Add ring-offset for better focus visibility

### 2.2 Create Enhanced Card Variants

**File:** `apps/web/components/ui/card.tsx`

**Enhancements:**
- Add `elevated` variant (stronger shadow, subtle border)
- Add `gradient` variant (gradient border effect)
- Add `interactive` variant (hover lift effect)
- Add `featured` variant (accent border, highlighted)
- Add hover transitions

### 2.3 Create Loading Component

**New File:** `apps/web/components/ui/loading.tsx`

**Features:**
- Spinner component with size variants
- Skeleton loader with animation
- Loading overlay
- Loading button state

### 2.4 Create Animation Utilities

**New File:** `apps/web/components/ui/motion.tsx`

**Features:**
- FadeIn wrapper component
- SlideUp wrapper component
- ScaleIn wrapper component
- Stagger container for lists
- Uses CSS animations (no Framer Motion dependency initially)

---

## Phase 3: Gemini Image Generation Pipeline

### 3.1 Create Image Generation Service

**New File:** `apps/web/lib/image-generation/gemini-client.ts`

**Features:**
```typescript
interface ImageGenerationConfig {
  prompt: string;
  context: string;
  brandColors: string[];
  aspectRatio: '1:1' | '16:9' | '4:3' | '9:16';
  resolution: '1K' | '2K' | '4K';
  style: 'modern' | 'minimalist' | 'bold' | 'elegant';
}

export async function generateImage(config: ImageGenerationConfig): Promise<GeneratedImage>
export async function generateIcon(config: IconConfig): Promise<GeneratedIcon>
```

### 3.2 Create Image Generation Types

**New File:** `apps/web/lib/image-generation/types.ts`

**Types:**
- `ImageGenerationConfig`
- `GeneratedImage`
- `IconConfig`
- `GeneratedIcon`
- `BrandAsset`

### 3.3 Create Asset Management Utilities

**New File:** `apps/web/lib/image-generation/asset-manager.ts`

**Features:**
- Save generated images to `/public/images/`
- Generate alt text from Gemini thinking output
- Optimize images for web
- Track generated assets

### 3.4 Create API Route for Image Generation

**New File:** `apps/web/app/api/generate-image/route.ts`

**Features:**
- POST endpoint for image generation
- Rate limiting
- Caching layer
- Error handling

### 3.5 Create React Hook for Image Generation

**New File:** `apps/web/hooks/use-image-generation.ts`

**Features:**
```typescript
export function useImageGeneration() {
  return {
    generateHeroImage,
    generateFeatureIcon,
    generateAvatar,
    isGenerating,
    error
  }
}
```

---

## Phase 4: UI Library Integration Patterns

### 4.1 Create Library Registry

**New File:** `apps/web/lib/design-system/library-registry.ts`

**Features:**
- Document available component libraries
- Map component types to preferred libraries
- Provide integration patterns

### 4.2 Create Motion Utilities (Motion Primitives Pattern)

**New File:** `apps/web/components/motion/text-reveal.tsx`
**New File:** `apps/web/components/motion/fade-in.tsx`
**New File:** `apps/web/components/motion/stagger-children.tsx`

**Features:**
- CSS-based animations initially
- Framer Motion upgrade path
- Consistent API with Motion Primitives

### 4.3 Create AI Interface Components (Prompt Kit Pattern)

**New File:** `apps/web/components/ai/prompt-input.tsx`
**New File:** `apps/web/components/ai/message-bubble.tsx`
**New File:** `apps/web/components/ai/response-stream.tsx`

**Features:**
- Styled AI input components
- Message threading UI
- Streaming response display
- File upload support

### 4.4 Create Marketing Blocks (StyleUI/KokonutUI Pattern)

**New File:** `apps/web/components/blocks/hero-section.tsx`
**New File:** `apps/web/components/blocks/feature-grid.tsx`
**New File:** `apps/web/components/blocks/testimonials.tsx`

**Features:**
- Pre-built section components
- Bento grid layouts
- Asymmetric hero options
- Card variations

---

## Phase 5: Design System Infrastructure

### 5.1 Create Design System Config

**New File:** `apps/web/lib/design-system/config.ts`

**Features:**
```typescript
export const designSystem = {
  brand: {
    name: 'PROJECT_NAME',
    industry: 'INDUSTRY',
    visualStyle: 'modern',
    colorScheme: 'adaptive'
  },
  typography: {
    headings: { /* scales */ },
    body: { /* scales */ }
  },
  spacing: { /* scales */ },
  components: { /* preferences */ }
}
```

### 5.2 Create Forbidden Pattern Detector

**New File:** `apps/web/lib/design-system/pattern-validator.ts`

**Features:**
- ESLint rule definitions for forbidden patterns
- Runtime className validator
- Component prop validator
- Development-only warnings

### 5.3 Create Pre-Generation Checklist Hook

**New File:** `apps/web/hooks/use-design-compliance.ts`

**Features:**
- Check component against design system
- Validate color token usage
- Ensure accessibility requirements
- Development-time warnings

---

## Phase 6: Quality Assurance System

### 6.1 Create ESLint Plugin for Design Patterns

**New File:** `apps/web/lib/eslint/design-rules.ts`

**Rules:**
- `no-generic-className` - Forbid patterns like `bg-white rounded-lg shadow p-4`
- `require-design-tokens` - Require color tokens instead of raw Tailwind colors
- `require-hover-states` - Ensure interactive elements have hover states

### 6.2 Create Component Quality Scorer

**New File:** `apps/web/lib/design-system/quality-scorer.ts`

**Metrics:**
- Visual distinctiveness
- Brand alignment
- Code quality
- Accessibility score

---

## Phase 7: Documentation & Examples

### 7.1 Create Design System Documentation

**New File:** `apps/web/docs/design-system/README.md`

**Contents:**
- Color token reference
- Typography scale
- Component usage guidelines
- Library integration examples

### 7.2 Create Example Components

**New File:** `apps/web/app/examples/page.tsx`

**Contents:**
- Component showcase
- Before/after comparisons
- Interactive demos

---

## File Structure After Implementation

```
apps/web/
├── app/
│   ├── globals.css                    # Enhanced with design tokens
│   ├── api/
│   │   └── generate-image/
│   │       └── route.ts               # Image generation API
│   └── examples/
│       └── page.tsx                   # Component showcase
├── components/
│   ├── ui/
│   │   ├── button.tsx                 # Enhanced with variants
│   │   ├── card.tsx                   # Enhanced with variants
│   │   ├── loading.tsx                # New loading states
│   │   └── motion.tsx                 # Animation wrappers
│   ├── motion/
│   │   ├── text-reveal.tsx            # Text animation
│   │   ├── fade-in.tsx                # Fade animation
│   │   └── stagger-children.tsx       # List animation
│   ├── ai/
│   │   ├── prompt-input.tsx           # AI input component
│   │   ├── message-bubble.tsx         # Chat message
│   │   └── response-stream.tsx        # Streaming response
│   └── blocks/
│       ├── hero-section.tsx           # Hero component
│       ├── feature-grid.tsx           # Feature grid
│       └── testimonials.tsx           # Testimonials
├── lib/
│   ├── design-system/
│   │   ├── config.ts                  # Design system config
│   │   ├── library-registry.ts        # UI library registry
│   │   ├── pattern-validator.ts       # Forbidden patterns
│   │   └── quality-scorer.ts          # Quality metrics
│   ├── image-generation/
│   │   ├── gemini-client.ts           # Gemini API client
│   │   ├── types.ts                   # Type definitions
│   │   └── asset-manager.ts           # Asset handling
│   └── eslint/
│       └── design-rules.ts            # Custom ESLint rules
├── hooks/
│   ├── use-image-generation.ts        # Image gen hook
│   └── use-design-compliance.ts       # Compliance hook
├── tailwind.config.ts                 # Extended configuration
└── docs/
    └── design-system/
        └── README.md                  # Documentation
```

---

## Implementation Order

### Batch 1: Foundation (Start Here)
1. Update `globals.css` with extended design tokens
2. Extend `tailwind.config.ts` with animations and colors
3. Enhance `button.tsx` and `card.tsx` with new variants

### Batch 2: Core Components
4. Create `loading.tsx` and `motion.tsx`
5. Create motion components (`text-reveal`, `fade-in`, `stagger-children`)
6. Create design system config and library registry

### Batch 3: Image Generation
7. Create Gemini client and types
8. Create asset manager
9. Create API route and React hook

### Batch 4: AI & Marketing Blocks
10. Create AI interface components
11. Create marketing block components

### Batch 5: Quality Assurance
12. Create pattern validator
13. Create ESLint rules (optional)
14. Create quality scorer

### Batch 6: Documentation
15. Create design system documentation
16. Create example showcase page

---

## Dependencies Required

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.x.x"
  },
  "devDependencies": {
    "framer-motion": "^11.x.x"
  }
}
```

**Note:** Framer Motion is optional - CSS animations work initially

---

## Environment Variables Required

```env
# Gemini Image Generation
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

---

## Success Criteria

- [ ] All color usage references design tokens (no raw Tailwind colors)
- [ ] No forbidden patterns in generated code
- [ ] All interactive components have hover/focus/active states
- [ ] Loading states on all async components
- [ ] Image generation pipeline functional
- [ ] At least 3 enhanced component variants per base component
- [ ] Motion components working with CSS animations
- [ ] AI interface components styled and functional
- [ ] Marketing blocks with bento/asymmetric layouts
- [ ] Documentation complete with examples

---

## Risk Considerations

1. **Gemini API Availability**: Image generation depends on Gemini API access
   - Mitigation: Placeholder images and graceful fallbacks

2. **Bundle Size**: Adding animation libraries increases bundle
   - Mitigation: Start with CSS, lazy-load Framer Motion

3. **Breaking Changes**: Modifying existing components may affect pages
   - Mitigation: New variants are additive, defaults unchanged

4. **Team Adoption**: New patterns require learning
   - Mitigation: Comprehensive documentation and examples
