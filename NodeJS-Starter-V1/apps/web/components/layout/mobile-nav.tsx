"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Home, Package, Users, ShoppingCart, FileText, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/dashboard/products", icon: Package, label: "Products" },
  { href: "/dashboard/customers", icon: Users, label: "Customers" },
  { href: "/dashboard/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/dashboard/quotes", icon: FileText, label: "Quotes" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
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
          className="md:hidden fixed top-4 left-4 z-50"
        >
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 backdrop-blur-sm border shadow-md hover:shadow-lg transition-shadow"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={open ? "close" : "menu"}
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
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="text-left text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
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
                transition={{ delay: index * 0.05, type: "spring", stiffness: 300 }}
              >
                <Link
                  href={item.href as any}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative overflow-hidden group",
                    "hover:bg-accent hover:text-accent-foreground hover:scale-105",
                    isActive && "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-indicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary-foreground rounded-r-full"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}

                  {/* Icon with animation */}
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 15 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>

                  <span className="font-medium relative z-10">{item.label}</span>

                  {/* Hover effect */}
                  {!isActive && (
                    <motion.div
                      className="absolute inset-0 bg-primary/5 rounded-lg"
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
            className="mt-6 pt-6 border-t"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: navItems.length * 0.05 + 0.1 }}
          >
            <motion.button
              className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left transition-all duration-200 hover:bg-destructive/10 text-destructive relative overflow-hidden group"
              onClick={() => {
                setOpen(false);
                // Handle logout
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div
                whileHover={{ scale: 1.2, rotate: -15 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <LogOut className="h-5 w-5" />
              </motion.div>
              <span className="font-medium">Logout</span>

              {/* Hover background */}
              <motion.div
                className="absolute inset-0 bg-destructive/5 rounded-lg"
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
