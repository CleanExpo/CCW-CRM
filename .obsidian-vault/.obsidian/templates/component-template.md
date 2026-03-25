---
type: component
id: COMPONENT-{{COMPONENT_NUMBER}}
file: apps/web/{{FILE_PATH}}.tsx
category: ui|forms|layout|dashboard|domain-specific
reusable: true|false
reference_pattern: true|false
status: Active|Deprecated
links:
  - '[[PAGE-NNN]]'
  - '[[COMPONENT-NNN]]'
last_verified: { { DATE } }
---

# COMPONENT-{{COMPONENT_NUMBER}}: {{COMPONENT_NAME}}

## Overview

{{DESCRIPTION}}

<!-- AUTO-GENERATED -->

## Component API

**File**: `apps/web/{{FILE_PATH}}.tsx`

**Props**:

| Prop     | Type              | Required | Default | Description       |
| -------- | ----------------- | -------- | ------- | ----------------- |
| prop1    | string            | Yes      | -       | Description       |
| prop2    | number            | No       | 0       | Description       |
| prop3    | boolean           | No       | false   | Description       |
| onAction | (data: T) => void | No       | -       | Callback function |

**Example Usage**:

```tsx
import { {{COMPONENT_NAME}} } from '@/components/{{PATH}}';

export default function Page() {
  return (
    <{{COMPONENT_NAME}}
      prop1="value"
      prop2={123}
      prop3={true}
      onAction={(data) => console.log(data)}
    />
  );
}
```

## Dependencies

**UI Components**:

- `Button` from `@/components/ui/button`
- `Dialog` from `@/components/ui/dialog`
- `Input` from `@/components/ui/input`

**Hooks**:

- `useState` from React
- `useForm` from react-hook-form
- Custom hooks: `useToast`, etc.

**API Clients**:

- `apiClient` from `@/lib/api/client`
- [[ROUTE-NNN]]: API calls made by this component

## State Management

- Local state: `useState` for UI state
- Form state: React Hook Form
- Validation: Zod schema

## Used By Pages

- [[PAGE-NNN]]: Usage context
- [[PAGE-NNN]]: Usage context

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Design Decisions

Document why this component was built this way:

- Why not use an existing component?
- Trade-offs considered
- Alternative approaches rejected

## Usage Guidelines

When to use this component:

- ✅ Use when: Scenario 1
- ✅ Use when: Scenario 2
- ❌ Don't use when: Scenario 3

## Styling Notes

- Design system tokens used: `bg-primary`, `text-foreground`
- Responsive breakpoints: mobile/tablet/desktop
- Dark mode support: Yes/No

## Accessibility

- ARIA labels: Implemented
- Keyboard navigation: Tab order, Enter/Space handlers
- Screen reader: Announcements for state changes

## Testing

- Unit tests: `__tests__/components/{{COMPONENT_NAME}}.test.tsx`
- Coverage: N%
- E2E tests: Included in page E2E tests

## Known Issues

Document:

- Browser compatibility issues
- Edge cases
- TODOs

<!-- END HUMAN-CURATED -->

## Props Interface

```typescript
interface {{COMPONENT_NAME}}Props {
  prop1: string;
  prop2?: number;
  prop3?: boolean;
  onAction?: (data: ActionData) => void;
}

interface ActionData {
  field1: string;
  field2: number;
}
```

## Component Tree

```
{{COMPONENT_NAME}}
├── Dialog
│   ├── DialogTrigger (Button)
│   ├── DialogContent
│   │   ├── DialogHeader
│   │   │   └── DialogTitle
│   │   ├── Form
│   │   │   ├── FormField (Input)
│   │   │   └── FormField (Select)
│   │   └── DialogFooter
│   │       ├── Button (Cancel)
│   │       └── Button (Submit)
```

## Related Components

- [[COMPONENT-NNN]]: Parent component
- [[COMPONENT-NNN]]: Similar component
- [[COMPONENT-NNN]]: Used together with

## Change History

| Date     | Change  | Author         |
| -------- | ------- | -------------- |
| {{DATE}} | Created | Auto-generated |
