/**
 * Hook for managing keyboard shortcuts
 *
 * Provides a unified system for registering and handling keyboard shortcuts
 * with conflict detection and priority management.
 */

"use client";

import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  enabled?: boolean;
  priority?: number; // Higher priority shortcuts override lower ones
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs/textareas
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Exception: Allow Cmd+K / Ctrl+K in inputs to open command palette
        if (
          (event.key === "k" || event.key === "K") &&
          (event.metaKey || event.ctrlKey)
        ) {
          // Let it pass through
        } else {
          return;
        }
      }

      // Find matching shortcuts
      const matchingShortcuts = shortcutsRef.current.filter((shortcut) => {
        if (shortcut.enabled === false) return false;

        const keyMatch =
          event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlKey === event.ctrlKey;
        const shiftMatch = !!shortcut.shiftKey === event.shiftKey;
        const altMatch = !!shortcut.altKey === event.altKey;
        const metaMatch = !!shortcut.metaKey === event.metaKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
      });

      if (matchingShortcuts.length === 0) return;

      // Sort by priority (higher first)
      matchingShortcuts.sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      );

      // Execute highest priority shortcut
      const shortcut = matchingShortcuts[0];
      event.preventDefault();
      event.stopPropagation();
      shortcut.action();
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  return {
    shortcuts: shortcutsRef.current,
  };
}

/**
 * Format keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  if (shortcut.metaKey) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (shortcut.ctrlKey) {
    parts.push("Ctrl");
  }
  if (shortcut.altKey) {
    parts.push(isMac ? "⌥" : "Alt");
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? "⇧" : "Shift");
  }

  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? "" : "+");
}
