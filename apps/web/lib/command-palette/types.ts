/**
 * Command Palette Types
 * Type definitions for the global command palette system
 */

import { LucideIcon } from "lucide-react";

export type CommandGroup =
  | "navigation"
  | "actions"
  | "search"
  | "settings"
  | "recent";

export interface Command {
  id: string;
  label: string;
  description?: string;
  keywords: string[];
  icon?: LucideIcon;
  group: CommandGroup;
  action: () => void;
  shortcut?: string;
}

export interface RecentPage {
  path: string;
  title: string;
  timestamp: number;
}

export interface CommandGroupConfig {
  id: CommandGroup;
  label: string;
  priority: number; // Lower number = higher priority
}
