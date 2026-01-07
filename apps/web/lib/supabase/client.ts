/**
 * Supabase client stub - replaced with FastAPI client
 *
 * This file exports our custom apiClient to maintain compatibility
 * with code that still imports from @/lib/supabase/client
 */

import { apiClient } from "@/lib/api/client";

export function createClient() {
  return apiClient;
}
