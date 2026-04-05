/**
 * PHASE 4: Autosave Hook for React Hook Form
 *
 * Automatically saves form state to localStorage with debouncing.
 * Prevents data loss on dialog close, navigation, or page refresh.
 *
 * Usage:
 * ```tsx
 * const form = useForm<FormData>({ ... });
 * const { hasDraft, loadDraft, clearDraft } = useAutosave({
 *   key: 'order-form',
 *   formValues: form.watch(),
 *   onRestore: (data) => form.reset(data),
 * });
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { DraftStorage } from '@/lib/utils/draft-storage';

interface UseAutosaveOptions<T> {
  /** Unique key for this form draft (e.g., 'order-form', 'quote-form-{id}') */
  key: string;

  /** Current form values (use form.watch() for React Hook Form) */
  formValues: T;

  /** Callback to restore draft data into form */
  onRestore?: (data: T) => void;

  /** Debounce delay in milliseconds (default: 1000ms) */
  debounceMs?: number;

  /** Expiry in days (default: 7) */
  expiryDays?: number;

  /** Enable autosave (default: true) */
  enabled?: boolean;

  /** Fields to exclude from autosave (e.g., passwords, sensitive data) */
  excludeFields?: (keyof T)[];
}

interface UseAutosaveReturn<T> {
  /** Whether a draft exists for this form */
  hasDraft: boolean;

  /** Saved draft metadata (timestamp, etc.) */
  draftMetadata: { savedAt: string } | null;

  /** Load and restore draft into form */
  loadDraft: () => void;

  /** Clear saved draft */
  clearDraft: () => void;

  /** Manually trigger save (useful for critical actions) */
  saveDraft: () => void;

  /** Whether autosave is currently active */
  isAutosaving: boolean;
}

export function useAutosave<T extends Record<string, unknown>>({
  key,
  formValues,
  onRestore,
  debounceMs = 1000,
  expiryDays = 7,
  enabled = true,
  excludeFields = [],
}: UseAutosaveOptions<T>): UseAutosaveReturn<T> {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftMetadata, setDraftMetadata] = useState<{ savedAt: string } | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(false);

  // Check for existing draft on mount
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      const exists = DraftStorage.exists(key);
      setHasDraft(exists);

      if (exists) {
        const metadata = DraftStorage.getMetadata(key);
        if (metadata) {
          setDraftMetadata({ savedAt: metadata.savedAt });
        }
      }
    }
  }, [key]);

  // Filter out excluded fields
  const filterData = useCallback(
    (data: T): T => {
      if (excludeFields.length === 0) return data;

      const filtered = { ...data };
      excludeFields.forEach((field) => {
        delete filtered[field];
      });
      return filtered;
    },
    [excludeFields]
  );

  // Manual save function
  const saveDraft = useCallback(() => {
    if (!enabled) return;

    const filteredData = filterData(formValues);

    // Don't save if form is empty
    const hasData = Object.values(filteredData).some((value) => {
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    });

    if (!hasData) return;

    setIsAutosaving(true);
    const success = DraftStorage.save(key, filteredData, expiryDays);

    if (success) {
      setHasDraft(true);
      setDraftMetadata({ savedAt: new Date().toISOString() });
    }

    setIsAutosaving(false);
  }, [key, formValues, enabled, expiryDays, filterData]);

  // Debounced autosave on form change
  useEffect(() => {
    if (!enabled || !initialLoadRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formValues, enabled, debounceMs, saveDraft]);

  // Load draft
  const loadDraft = useCallback(() => {
    const draft = DraftStorage.load<T>(key);
    if (draft && onRestore) {
      onRestore(draft);
      console.info(`Draft restored for [${key}]`);
    }
  }, [key, onRestore]);

  // Clear draft
  const clearDraft = useCallback(() => {
    DraftStorage.clear(key);
    setHasDraft(false);
    setDraftMetadata(null);
  }, [key]);

  // Save on unmount (if enabled)
  useEffect(() => {
    return () => {
      if (enabled && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Final save on unmount
        const filteredData = filterData(formValues);
        const hasData = Object.values(filteredData).some((value) => {
          if (value === null || value === undefined || value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        });
        if (hasData) {
          DraftStorage.save(key, filteredData, expiryDays);
        }
      }
    };
  }, [key, formValues, enabled, expiryDays, filterData]);

  return {
    hasDraft,
    draftMetadata,
    loadDraft,
    clearDraft,
    saveDraft,
    isAutosaving,
  };
}
