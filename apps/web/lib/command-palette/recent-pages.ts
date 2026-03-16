/**
 * Recent Pages Tracking
 * Manages recent page history in localStorage for command palette
 */

import { RecentPage } from "./types";

const STORAGE_KEY = "command-palette-recent-pages";
const MAX_RECENT_PAGES = 5;

/**
 * Get recent pages from localStorage
 */
export function getRecentPages(): RecentPage[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const pages: RecentPage[] = JSON.parse(stored);
    // Filter out any invalid entries and sort by timestamp (newest first)
    return pages
      .filter((page) => page.path && page.title && page.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_RECENT_PAGES);
  } catch (error) {
    console.error("Failed to load recent pages:", error);
    return [];
  }
}

/**
 * Add a page to recent history
 */
export function addRecentPage(path: string, title: string): void {
  if (typeof window === "undefined") return;

  try {
    const pages = getRecentPages();

    // Remove existing entry for this path (if any)
    const filtered = pages.filter((page) => page.path !== path);

    // Add new entry at the beginning
    const updated: RecentPage[] = [
      {
        path,
        title,
        timestamp: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_PAGES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save recent page:", error);
  }
}

/**
 * Clear all recent pages
 */
export function clearRecentPages(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear recent pages:", error);
  }
}

/**
 * Get page title from path (fallback if not provided)
 */
export function getPageTitleFromPath(path: string): string {
  // Remove leading slash and split by slash
  const segments = path.replace(/^\//, "").split("/");

  // Get the last segment or fallback to "Dashboard"
  const lastSegment = segments[segments.length - 1] || "dashboard";

  // Convert kebab-case to Title Case
  return lastSegment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
