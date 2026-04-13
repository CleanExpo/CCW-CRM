'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  ShoppingCart,
  Truck,
  Settings,
  CreditCard,
  UserPlus,
  Building2,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  type: 'customer' | 'product' | 'order';
}

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords?: string[];
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState(false);
  const debouncedQuery = useDebounce(query, 300);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Clear results when dialog closes
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSearchError(false);
    }
  }, [open]);

  // Live search when query >= 2 chars
  React.useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    async function search() {
      setSearchError(false);
      setSearching(true);
      try {
        const q = encodeURIComponent(debouncedQuery);
        const [customers, products, orders] = await Promise.allSettled([
          apiClient.get<{ items: { id: string; company_name: string; contact_name?: string }[] }>(
            `/api/customers?search=${q}&page_size=4`
          ),
          apiClient.get<{ items: { id: string; name: string; sku?: string }[] }>(
            `/api/products?search=${q}&page_size=4`
          ),
          apiClient.get<{ items: { id: string; order_number: string; customer_name?: string }[] }>(
            `/api/orders?search=${q}&page_size=4`
          ),
        ]);

        if (cancelled) return;

        const next: SearchResult[] = [];

        if (customers.status === 'fulfilled') {
          for (const c of customers.value.items ?? []) {
            next.push({
              id: `customer-${c.id}`,
              label: c.company_name,
              sublabel: c.contact_name,
              href: `/customers?highlight=${c.id}`,
              type: 'customer',
            });
          }
        }
        if (products.status === 'fulfilled') {
          for (const p of products.value.items ?? []) {
            next.push({
              id: `product-${p.id}`,
              label: p.name,
              sublabel: p.sku,
              href: `/products?highlight=${p.id}`,
              type: 'product',
            });
          }
        }
        if (orders.status === 'fulfilled') {
          for (const o of orders.value.items ?? []) {
            next.push({
              id: `order-${o.id}`,
              label: o.order_number,
              sublabel: o.customer_name,
              href: `/orders?highlight=${o.id}`,
              type: 'order',
            });
          }
        }

        const allFailed =
          customers.status === 'rejected' &&
          products.status === 'rejected' &&
          orders.status === 'rejected';
        setSearchError(allFailed);
        setResults(next);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }
    search();
    return () => {
      cancelled = true;
      setSearching(false);
    };
  }, [debouncedQuery]);

  const navigate = React.useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path as Route);
    },
    [router]
  );

  const commands: Command[] = React.useMemo(
    () => [
      {
        id: 'dashboard',
        label: 'Dashboard',
        description: 'View overview and metrics',
        icon: LayoutDashboard,
        action: () => navigate('/dashboard'),
        keywords: ['home', 'overview'],
      },
      {
        id: 'products',
        label: 'Products',
        description: 'Manage product catalog',
        icon: Package,
        action: () => navigate('/products'),
        keywords: ['catalog', 'items', 'inventory'],
      },
      {
        id: 'customers',
        label: 'Customers',
        description: 'Manage customer accounts',
        icon: Users,
        action: () => navigate('/customers'),
        keywords: ['clients', 'accounts'],
      },
      {
        id: 'orders',
        label: 'Orders',
        description: 'View and manage orders',
        icon: ShoppingCart,
        action: () => navigate('/orders'),
        keywords: ['sales', 'purchases'],
      },
      {
        id: 'quotes',
        label: 'Quotes',
        description: 'Create and manage quotes',
        icon: FileText,
        action: () => navigate('/quotes'),
        keywords: ['proposals', 'estimates'],
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        description: 'Manage supplier relationships',
        icon: Truck,
        action: () => navigate('/suppliers'),
        keywords: ['vendors'],
      },
      {
        id: 'new-product',
        label: 'New Product',
        description: 'Create a new product',
        icon: Package,
        action: () => navigate('/products?action=new'),
        keywords: ['create', 'add'],
      },
      {
        id: 'new-customer',
        label: 'New Customer',
        description: 'Add a new customer',
        icon: UserPlus,
        action: () => navigate('/customers?action=new'),
        keywords: ['create', 'add'],
      },
      {
        id: 'new-quote',
        label: 'New Quote',
        description: 'Create a new quote',
        icon: FileText,
        action: () => navigate('/quotes?action=new'),
        keywords: ['create', 'add', 'proposal'],
      },
      {
        id: 'settings-account',
        label: 'Account Settings',
        description: 'Manage your account',
        icon: Settings,
        action: () => navigate('/settings/account'),
        keywords: ['profile', 'preferences'],
      },
      {
        id: 'settings-team',
        label: 'Team Management',
        description: 'Manage team members and roles',
        icon: Users,
        action: () => navigate('/settings/team'),
        keywords: ['users', 'permissions'],
      },
      {
        id: 'settings-company',
        label: 'Company Settings',
        description: 'Update company information',
        icon: Building2,
        action: () => navigate('/settings/company'),
        keywords: ['organization', 'business'],
      },
      {
        id: 'settings-billing',
        label: 'Billing & Subscription',
        description: 'Manage billing and plans',
        icon: CreditCard,
        action: () => navigate('/settings/billing'),
        keywords: ['payment', 'subscription', 'plan'],
      },
    ],
    [navigate]
  );

  const navigationCommands = commands.filter((cmd) =>
    ['dashboard', 'products', 'customers', 'orders', 'quotes', 'suppliers'].includes(cmd.id)
  );
  const actionCommands = commands.filter((cmd) =>
    ['new-product', 'new-customer', 'new-quote'].includes(cmd.id)
  );
  const settingsCommands = commands.filter((cmd) => cmd.id.startsWith('settings-'));

  const typeIcon: Record<SearchResult['type'], React.ComponentType<{ className?: string }>> = {
    customer: Users,
    product: Package,
    order: ShoppingCart,
  };

  const showStatic = debouncedQuery.length < 2;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search customers, products, orders…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {/* Live search results */}
        {!showStatic && (
          <>
            {searching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              </div>
            ) : searchError ? (
              <CommandEmpty>Search unavailable — check your connection</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No results for &ldquo;{debouncedQuery}&rdquo;</CommandEmpty>
            ) : (
              <CommandGroup heading="Search Results">
                {results.map((r) => {
                  const Icon = typeIcon[r.type];
                  return (
                    <CommandItem
                      key={r.id}
                      onSelect={() => navigate(r.href)}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{r.label}</span>
                        {r.sublabel && (
                          <span className="text-muted-foreground text-xs">{r.sublabel}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </>
        )}

        {/* Static commands — shown when no query */}
        {showStatic && (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {navigationCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.id}
                    onSelect={() => command.action()}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-muted-foreground text-xs">{command.description}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              {actionCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.id}
                    onSelect={() => command.action()}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-muted-foreground text-xs">{command.description}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              {settingsCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <CommandItem
                    key={command.id}
                    onSelect={() => command.action()}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{command.label}</span>
                      {command.description && (
                        <span className="text-muted-foreground text-xs">{command.description}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
