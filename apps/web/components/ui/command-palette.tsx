/**
 * Global Command Palette Component
 * Cmd+K / Ctrl+K powered command palette for navigation and actions
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "cmdk";
import {
  createNavigationCommands,
  createActionCommands,
  createSearchCommands,
  createSettingsCommands,
  COMMAND_GROUPS,
} from "@/lib/command-palette/commands";
import {
  getRecentPages,
  addRecentPage,
  getPageTitleFromPath,
  clearRecentPages,
} from "@/lib/command-palette/recent-pages";
import type { Command as CommandType, RecentPage } from "@/lib/command-palette/types";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Clock, X } from "lucide-react";

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { open, setOpen } = useCommandPalette();
  const [search, setSearch] = useState("");
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  // Load recent pages on mount and when palette opens
  useEffect(() => {
    if (open) {
      setRecentPages(getRecentPages());
    }
  }, [open]);

  // Track page visits
  useEffect(() => {
    if (pathname) {
      const title = getPageTitleFromPath(pathname);
      addRecentPage(pathname, title);
    }
  }, [pathname]);

  // Navigation handler
  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path as any);
      // Reset search after navigation
      setTimeout(() => setSearch(""), 300);
    },
    [router, setOpen]
  );

  // Theme toggle (placeholder - integrate with your theme system)
  const toggleTheme = useCallback(() => {
    setOpen(false);
    // TODO: Integrate with your theme toggle logic
    console.log("Toggle theme");
  }, [setOpen]);

  // Logout handler (placeholder - integrate with your auth system)
  const logout = useCallback(() => {
    setOpen(false);
    // TODO: Integrate with your logout logic
    router.push("/login");
  }, [router, setOpen]);

  // Create all commands
  const navigationCommands = createNavigationCommands(navigate);
  const actionCommands = createActionCommands(navigate);
  const searchCommands = createSearchCommands(navigate);
  const settingsCommands = createSettingsCommands(navigate, toggleTheme, logout);

  // Create recent commands from recent pages
  const recentCommands: CommandType[] = recentPages.map((page) => ({
    id: `recent-${page.path}`,
    label: page.title,
    description: page.path,
    keywords: [page.title, page.path, "recent", "history"],
    icon: Clock,
    group: "recent",
    action: () => navigate(page.path),
  }));

  // Combine all commands
  const allCommands = [
    ...recentCommands,
    ...navigationCommands,
    ...actionCommands,
    ...searchCommands,
    ...settingsCommands,
  ];

  // Group commands by category
  const groupedCommands = COMMAND_GROUPS.map((groupConfig) => ({
    ...groupConfig,
    commands: allCommands.filter((cmd) => cmd.group === groupConfig.id),
  })).filter((group) => group.commands.length > 0);

  // Clear recent pages handler
  const handleClearRecent = useCallback(() => {
    clearRecentPages();
    setRecentPages([]);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-2xl">
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          shouldFilter={true}
          filter={(value, search, keywords) => {
            const normalizedSearch = search.toLowerCase().trim();
            if (!normalizedSearch) return 1;

            // Search in label, description, and keywords
            const label = value.toLowerCase();
            const keywordString = keywords?.join(" ").toLowerCase() || "";

            if (label.includes(normalizedSearch)) return 1;
            if (keywordString.includes(normalizedSearch)) return 0.8;

            // Fuzzy matching: check if all characters appear in order
            let searchIndex = 0;
            for (let i = 0; i < label.length && searchIndex < normalizedSearch.length; i++) {
              if (label[i] === normalizedSearch[searchIndex]) {
                searchIndex++;
              }
            }
            if (searchIndex === normalizedSearch.length) return 0.6;

            return 0;
          }}
        >
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Command.Input
              placeholder="Type a command or search..."
              value={search}
              onValueChange={setSearch}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {groupedCommands.map((group) => (
              <Command.Group
                key={group.id}
                heading={
                  <div className="flex items-center justify-between">
                    <span>{group.label}</span>
                    {group.id === "recent" && recentPages.length > 0 && (
                      <button
                        onClick={handleClearRecent}
                        className="text-xs hover:text-foreground transition-colors flex items-center gap-1"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    )}
                  </div>
                }
                className="[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:justify-between"
              >
                {group.commands.map((command) => {
                  const Icon = command.icon;
                  return (
                    <Command.Item
                      key={command.id}
                      value={command.label}
                      keywords={command.keywords}
                      onSelect={() => command.action()}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 gap-2"
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" />}
                      <div className="flex-1 flex flex-col">
                        <span className="font-medium">{command.label}</span>
                        {command.description && (
                          <span className="text-xs text-muted-foreground">
                            {command.description}
                          </span>
                        )}
                      </div>
                      {command.shortcut && (
                        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                          {command.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>

          <div className="border-t p-2 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ↵
                </kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ESC
                </kbd>
                Close
              </span>
            </div>
            <span className="text-[10px]">
              {allCommands.length} commands available
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
