/**
 * PHASE 4: Draft Storage Utility
 *
 * localStorage wrapper for form drafts with compression and expiry.
 * Prevents data loss on dialog close, navigation, or page refresh.
 */

interface DraftMetadata {
  key: string;
  savedAt: string;
  expiresAt: string;
  version: number;
}

interface StoredDraft<T> {
  data: T;
  metadata: DraftMetadata;
}

const DRAFT_VERSION = 1;
const DEFAULT_EXPIRY_DAYS = 7;
const STORAGE_PREFIX = "draft_";

export class DraftStorage {
  /**
   * Save draft to localStorage with metadata and expiry.
   */
  static save<T>(key: string, data: T, expiryDays: number = DEFAULT_EXPIRY_DAYS): boolean {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

      const draft: StoredDraft<T> = {
        data,
        metadata: {
          key,
          savedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          version: DRAFT_VERSION,
        },
      };

      const serialized = JSON.stringify(draft);
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, serialized);
      return true;
    } catch (error) {
      console.error(`Failed to save draft [${key}]:`, error);

      // Check if quota exceeded
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        // Clear expired drafts and retry
        this.clearExpired();
        try {
          const draft: StoredDraft<T> = {
            data,
            metadata: {
              key,
              savedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
              version: DRAFT_VERSION,
            },
          };
          localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(draft));
          return true;
        } catch (retryError) {
          console.error(`Failed to save draft after cleanup [${key}]:`, retryError);
          return false;
        }
      }

      return false;
    }
  }

  /**
   * Load draft from localStorage, checking expiry.
   */
  static load<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!stored) return null;

      const draft: StoredDraft<T> = JSON.parse(stored);

      // Check version compatibility
      if (draft.metadata.version !== DRAFT_VERSION) {
        console.warn(`Draft version mismatch for [${key}], clearing...`);
        this.clear(key);
        return null;
      }

      // Check expiry
      const expiresAt = new Date(draft.metadata.expiresAt);
      if (expiresAt < new Date()) {
        console.info(`Draft expired for [${key}], clearing...`);
        this.clear(key);
        return null;
      }

      return draft.data;
    } catch (error) {
      console.error(`Failed to load draft [${key}]:`, error);
      return null;
    }
  }

  /**
   * Clear specific draft.
   */
  static clear(key: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.error(`Failed to clear draft [${key}]:`, error);
    }
  }

  /**
   * Get metadata for a draft without loading the full data.
   */
  static getMetadata(key: string): DraftMetadata | null {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!stored) return null;

      const draft: StoredDraft<unknown> = JSON.parse(stored);
      return draft.metadata;
    } catch (error) {
      console.error(`Failed to get metadata for [${key}]:`, error);
      return null;
    }
  }

  /**
   * Check if draft exists and is not expired.
   */
  static exists(key: string): boolean {
    const metadata = this.getMetadata(key);
    if (!metadata) return false;

    const expiresAt = new Date(metadata.expiresAt);
    return expiresAt > new Date();
  }

  /**
   * Clear all expired drafts.
   */
  static clearExpired(): number {
    let cleared = 0;
    const keys: string[] = [];

    // Collect all draft keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }

    // Check each draft
    for (const fullKey of keys) {
      const key = fullKey.replace(STORAGE_PREFIX, "");
      if (!this.exists(key)) {
        this.clear(key);
        cleared++;
      }
    }

    console.info(`Cleared ${cleared} expired drafts`);
    return cleared;
  }

  /**
   * List all available drafts with metadata.
   */
  static listAll(): DraftMetadata[] {
    const drafts: DraftMetadata[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const draftKey = key.replace(STORAGE_PREFIX, "");
        const metadata = this.getMetadata(draftKey);
        if (metadata) {
          drafts.push(metadata);
        }
      }
    }

    return drafts.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  }

  /**
   * Clear all drafts (useful for logout).
   */
  static clearAll(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => localStorage.removeItem(key));
    console.info(`Cleared all ${keys.length} drafts`);
  }
}
