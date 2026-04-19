'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LayoutDashboard, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { navGroups } from '@/components/layout/sidebar';

async function logout(router: ReturnType<typeof useRouter>) {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore — clear client state regardless
  }
  localStorage.removeItem('onboarding_completed');
  router.push('/login');
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(['operations', 'crm', 'inventory'])
  );
  const pathname = usePathname();
  const router = useRouter();

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed top-4 left-4 z-50 md:hidden"
        >
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 border shadow-md backdrop-blur-sm transition-shadow hover:shadow-lg"
          >
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
            <span className="sr-only">Toggle menu</span>
          </Button>
        </motion.div>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-full flex-col p-0 sm:w-72">
        <SheetHeader className="shrink-0 border-b p-6">
          <SheetTitle className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-left text-xl font-bold text-transparent">
            CCW ERP
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {/* Dashboard — always visible, no group */}
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200',
              'hover:bg-accent hover:text-accent-foreground',
              pathname === '/dashboard' &&
                'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
            )}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" />
            <span className="font-medium">Dashboard</span>
          </Link>

          {/* All nav groups from the shared config */}
          {navGroups.map((group) => {
            const isOpen = openGroups.has(group.id);
            const hasActiveItem = group.items.some((item) => pathname.startsWith(item.href));

            return (
              <div key={group.id} className="mt-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors',
                    hasActiveItem ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{group.label}</span>
                  {isOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-200',
                            'hover:bg-accent hover:text-accent-foreground',
                            isActive &&
                              'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="font-medium">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-6 border-t pt-6">
            <motion.button
              className="hover:bg-destructive/10 text-destructive group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-all duration-200"
              onClick={() => {
                setOpen(false);
                void logout(router);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="font-medium">Logout</span>
            </motion.button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
