/**
 * Hook for managing filter presets in localStorage
 *
 * Provides CRUD operations for saved filter presets
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ActiveFilter, FilterPreset } from "@/components/advanced-search/AdvancedSearchFilter";

const STORAGE_KEY_PREFIX = "filter-presets-";

export function useFilterPresets(pageKey: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${pageKey}`;
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [loading, setLoading] = useState(true);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPresets(parsed);
      }
    } catch (error) {
      console.error("Failed to load filter presets:", error);
    } finally {
      setLoading(false);
    }
  }, [storageKey]);

  // Save presets to localStorage whenever they change
  const saveToStorage = useCallback(
    (updatedPresets: FilterPreset[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
      } catch (error) {
        console.error("Failed to save filter presets:", error);
      }
    },
    [storageKey]
  );

  // Save a new preset
  const savePreset = useCallback(
    (name: string, filters: ActiveFilter[]) => {
      const newPreset: FilterPreset = {
        id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        filters,
      };

      const updatedPresets = [...presets, newPreset];
      setPresets(updatedPresets);
      saveToStorage(updatedPresets);

      return newPreset;
    },
    [presets, saveToStorage]
  );

  // Delete a preset
  const deletePreset = useCallback(
    (presetId: string) => {
      const updatedPresets = presets.filter((p) => p.id !== presetId);
      setPresets(updatedPresets);
      saveToStorage(updatedPresets);
    },
    [presets, saveToStorage]
  );

  // Update a preset
  const updatePreset = useCallback(
    (presetId: string, name: string, filters: ActiveFilter[]) => {
      const updatedPresets = presets.map((p) =>
        p.id === presetId ? { ...p, name, filters } : p
      );
      setPresets(updatedPresets);
      saveToStorage(updatedPresets);
    },
    [presets, saveToStorage]
  );

  // Clear all presets
  const clearAll = useCallback(() => {
    setPresets([]);
    saveToStorage([]);
  }, [saveToStorage]);

  return {
    presets,
    loading,
    savePreset,
    deletePreset,
    updatePreset,
    clearAll,
  };
}
