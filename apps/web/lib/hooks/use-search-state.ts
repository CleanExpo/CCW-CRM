'use client';

import { useState, useEffect, useCallback } from 'react';

interface SearchState {
  search?: string;
  page?: number;
  filters?: Record<string, string | boolean | number>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- index signature needs `any` for dynamic property access across consumers
  [key: string]: any;
}

interface UseSearchStateOptions {
  key: string;
  defaultState?: SearchState;
}

/**
 * PHASE 4: Search State Persistence Hook
 *
 * Persists search, filters, and pagination state to sessionStorage
 * so users don't lose their place when navigating back to list pages.
 *
 * @example
 * const { state, setState, clearState } = useSearchState({
 *   key: "products-search",
 *   defaultState: { search: "", page: 1 }
 * });
 */
export function useSearchState({ key, defaultState = {} }: UseSearchStateOptions) {
  const [state, setStateInternal] = useState<SearchState>(defaultState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load state from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`search-state-${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setStateInternal(parsed);
      }
    } catch (error) {
      console.error(`Failed to load search state for ${key}:`, error);
    } finally {
      setIsHydrated(true);
    }
  }, [key]);

  // Save state to sessionStorage whenever it changes
  const setState = useCallback(
    (newState: SearchState | ((prev: SearchState) => SearchState)) => {
      setStateInternal((prev) => {
        const updated = typeof newState === 'function' ? newState(prev) : newState;

        try {
          sessionStorage.setItem(`search-state-${key}`, JSON.stringify(updated));
        } catch (error) {
          console.error(`Failed to save search state for ${key}:`, error);
        }

        return updated;
      });
    },
    [key]
  );

  // Clear state from sessionStorage
  const clearState = useCallback(() => {
    try {
      sessionStorage.removeItem(`search-state-${key}`);
      setStateInternal(defaultState);
    } catch (error) {
      console.error(`Failed to clear search state for ${key}:`, error);
    }
  }, [key, defaultState]);

  // Update specific field
  const updateField = useCallback(
    (field: string, value: string | number | boolean) => {
      setState((prev) => ({ ...prev, [field]: value }));
    },
    [setState]
  );

  return {
    state,
    setState,
    updateField,
    clearState,
    isHydrated, // Use this to prevent hydration mismatches
  };
}
