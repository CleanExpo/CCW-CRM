'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  X,
  Home,
  Package,
  Users,
  ShoppingCart,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { logoutAndRedirectToLogin } from '@/lib/api/auth';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/dashboard/inventory/products', icon: Package, label: 'Products' },
  { href: '/dashboard/crm/customers', icon: Users, label: 'Customers' },
  { href: '/dashboard/operations/orders', icon: ShoppingCart, label: 'Sales orders' },
  { href: '/dashboard/operations/quotes', icon: FileText, label: 'Quotes' },
  { href: '/dashboard/settings/integrations', icon: Settings, label: 'Integrations' },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
            className="border border-white/15 bg-zinc-950/90 text-foreground shadow-lg shadow-black/40 backdrop-blur-md transition-shadow hover:shadow-xl"
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
      <SheetContent side="left" className="w-full p-0 sm:w-64">
        <SheetHeader className="border-b p-6">
          <SheetTitle className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-left text-xl font-bold text-transparent">
            CCW ERP
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 overflow-hidden rounded-lg px-4 py-3 transition-all duration-200',
                    'hover:bg-accent hover:text-accent-foreground hover:scale-105',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md'
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-indicator"
                      className="bg-primary-foreground absolute top-0 bottom-0 left-0 w-1 rounded-r-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}

                  {/* Icon with animation */}
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 15 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>

                  <span className="relative z-10 font-medium">{item.label}</span>

                  {/* Hover effect */}
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

          <motion.div
            className="mt-6 border-t pt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: navItems.length * 0.05 + 0.1 }}
          >
            <motion.button
              type="button"
              className="hover:bg-destructive/10 text-destructive group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-4 py-3 text-left transition-all duration-200"
              onClick={async () => {
                setOpen(false);
                await logoutAndRedirectToLogin();
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                whileHover={{ scale: 1.2, rotate: -15 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <LogOut className="h-5 w-5" />
              </motion.div>
              <span className="font-medium">Logout</span>

              {/* Hover background */}
              <motion.div
                className="bg-destructive/5 absolute inset-0 rounded-lg"
                initial={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
            </motion.button>
          </motion.div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
