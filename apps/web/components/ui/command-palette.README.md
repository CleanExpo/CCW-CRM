# Command Palette Documentation

## Overview

The Command Palette is a global keyboard-driven navigation and action system inspired by modern applications like Linear, GitHub, and Vercel. It provides power users with instant access to any page, action, or setting in the CCW-Online ERP system.

## Features

### 1. **Global Keyboard Shortcut**
- **Mac**: `Cmd + K`
- **Windows/Linux**: `Ctrl + K`
- Press once to open, press again (or `ESC`) to close

### 2. **Fuzzy Search**
- Type any part of a command name to filter results
- Searches across: command labels, descriptions, and keywords
- Smart fuzzy matching: "prod inv" matches "Products Inventory"

### 3. **Command Groups**

#### Recent Pages (Dynamic)
- Automatically tracks your last 5 visited pages
- Persisted in localStorage
- Click "Clear" to reset history
- Most recent pages appear first

#### Navigation (28 commands)
Complete access to all dashboard pages:
- Core: Dashboard, Products, Inventory, Warehouse, Containers, Backorders
- Sales: Customers, Orders, POS Terminal, Reconciliation, Quotes
- Procurement: Purchase Orders, Submissions, Shipments, Suppliers
- Communication: Emails, Marketing
- Intelligence: PRD Generator, Insights, Alerts, Approvals, Monitoring, Analytics, Reports
- System: Settings, Admin, Tasks, Agents, AI Assistant

**Keyboard shortcuts** (type in command palette):
- `G D` - Go to Dashboard
- `G P` - Go to Products
- `G I` - Go to Inventory
- `G W` - Go to Warehouse
- `G C` - Go to Customers
- `G O` - Go to Orders
- `G Q` - Go to Quotes
- `G S` - Go to Settings

#### Quick Actions (6 commands)
Instant action triggers:
- Create Product (`C P`)
- New Customer (`C C`)
- New Order (`C O`)
- New Quote (`C Q`)
- New Purchase Order
- Generate PRD

#### Search (4 commands)
Quick search focus (opens page with search box focused):
- Search Products (`S P`)
- Search Customers (`S C`)
- Search Orders (`S O`)
- Search Inventory (`S I`)

#### Settings (8 commands)
System configuration:
- Account Settings
- Company Settings
- Team Settings
- Integrations
- Translations
- Billing
- Toggle Theme (`T`)
- Logout

### 4. **Visual Design**
- **Beautiful UI**: Clean, modern design with shadcn/ui components
- **Smooth animations**: Framer Motion transitions
- **Keyboard hints**: Visual indicators for keyboard shortcuts
- **Command count**: Shows total available commands
- **Empty state**: Helpful message when no results found

### 5. **Persistent Recent History**
- Uses localStorage to remember recent pages across sessions
- Maximum 5 recent pages
- Automatically adds current page on navigation
- Duplicate detection (won't add same page twice in a row)

## Architecture

### File Structure
```
apps/web/
├── lib/command-palette/
│   ├── types.ts              # TypeScript type definitions
│   ├── commands.ts           # Command definitions and groups
│   └── recent-pages.ts       # Recent pages localStorage utility
├── hooks/
│   └── use-command-palette.ts  # Keyboard shortcut hook
└── components/ui/
    └── command-palette.tsx   # Main component
```

### Dependencies
- **cmdk**: Command palette primitives (already installed)
- **lucide-react**: Icons
- **framer-motion**: Animations
- **next/navigation**: Router integration
- **shadcn/ui**: Dialog component

### Integration Points

1. **Root Layout** (`app/layout.tsx`)
   - CommandPalette component added at root level
   - Available on every page of the application

2. **Sidebar** (`components/layout/sidebar.tsx`)
   - Visual hint: "Quick search ⌘K" at bottom
   - Encourages discovery of the feature

3. **Router Integration**
   - All navigation uses Next.js router (`useRouter`)
   - Smooth client-side navigation
   - No page reloads

4. **Recent Pages Tracking**
   - Uses `usePathname()` hook to detect page changes
   - Automatically updates localStorage
   - Graceful fallback if localStorage unavailable

## Usage Examples

### For End Users

**Open command palette:**
```
Press Cmd+K (Mac) or Ctrl+K (Windows)
```

**Search for products:**
```
1. Press Cmd+K
2. Type "products" or "prod"
3. Press Enter to navigate
```

**Create a new order:**
```
1. Press Cmd+K
2. Type "new order" or "C O"
3. Press Enter to start order creation
```

**Go to recent page:**
```
1. Press Cmd+K
2. Recent pages appear at top
3. Arrow down and press Enter
```

**Use keyboard shortcuts:**
```
1. Press Cmd+K
2. Type "G P" to go to Products
3. Or type "C C" to create customer
```

### For Developers

**Add new command:**
```typescript
// In lib/command-palette/commands.ts

// Add to navigation commands
{
  id: "nav-new-page",
  label: "New Page",
  description: "Description here",
  keywords: ["new", "page", "alias"],
  icon: YourIcon,
  group: "navigation",
  action: () => navigate("/new-page"),
  shortcut: "G N",  // Optional
}
```

**Add new action:**
```typescript
// In createActionCommands function
{
  id: "action-do-something",
  label: "Do Something",
  description: "Trigger an action",
  keywords: ["action", "do", "something"],
  icon: Plus,
  group: "actions",
  action: () => {
    // Custom logic here
    navigate("/somewhere");
    // or trigger a modal, etc.
  },
  shortcut: "C S",  // Optional
}
```

**Integrate with theme toggle:**
```typescript
// Update toggleTheme callback in command-palette.tsx
const toggleTheme = useCallback(() => {
  setOpen(false);
  // Call your theme toggle function
  yourThemeToggleFunction();
}, [setOpen]);
```

**Integrate with logout:**
```typescript
// Update logout callback in command-palette.tsx
const logout = useCallback(async () => {
  setOpen(false);
  // Call your logout function
  await yourLogoutFunction();
  router.push("/login");
}, [router, setOpen]);
```

## Performance

- **Lightweight**: ~28KB total (types + commands + utils + component)
- **Fast search**: cmdk handles 2000+ commands efficiently (we have 46)
- **Lazy loaded**: Component only renders when palette is open
- **No virtualization needed**: List is small enough for direct rendering
- **localStorage**: Minimal storage (~500 bytes for 5 recent pages)

## Browser Compatibility

- ✅ Chrome/Edge (Windows, Mac)
- ✅ Firefox (Windows, Mac)
- ✅ Safari (Mac)
- ✅ localStorage support required (graceful fallback if unavailable)

## Keyboard Navigation

- `Cmd+K` / `Ctrl+K` - Open/close palette
- `↑` / `↓` - Navigate commands
- `Enter` - Execute selected command
- `ESC` - Close palette
- Type to search and filter commands

## Future Enhancements

Potential additions:
1. **Command history**: Track frequently used commands
2. **Custom shortcuts**: Let users define their own keyboard shortcuts
3. **Command chaining**: Execute multiple commands in sequence
4. **Search scope**: Filter by command group before searching
5. **Mobile menu**: Trigger command palette from hamburger menu on mobile
6. **Voice activation**: "Hey CCW, go to products"
7. **Command arguments**: "Create order for Customer X"
8. **Plugin system**: Allow other parts of app to register commands dynamically

## Troubleshooting

**Cmd+K doesn't work:**
- Check if another browser extension is capturing the shortcut
- Try Ctrl+K (Windows) or Command+K (Mac)
- Check browser console for JavaScript errors

**Commands not appearing:**
- Clear browser cache and hard reload
- Check localStorage quota (unlikely)
- Verify command definitions in `commands.ts`

**Navigation not working:**
- Check Next.js router is initialized
- Verify routes exist in `app/(dashboard)/` folder
- Check browser console for routing errors

**Recent pages not saving:**
- Check localStorage is enabled in browser
- Check localStorage quota
- Try clearing localStorage: `localStorage.clear()`

## Metrics

Current implementation stats:
- **Total commands**: 46
- **Navigation commands**: 28
- **Action commands**: 6
- **Search commands**: 4
- **Settings commands**: 8
- **Command groups**: 5
- **Lines of code**: ~300 (component) + ~500 (commands) + ~100 (utils)
- **Bundle size**: ~28KB (estimated)

## Credits

Inspired by:
- Linear's command palette
- GitHub's command palette (Cmd+K)
- Vercel's command menu
- Built with [cmdk](https://cmdk.paco.me/) by Paco Coursey
