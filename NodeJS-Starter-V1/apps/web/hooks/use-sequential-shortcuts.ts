/**
 * Hook for sequential keyboard shortcuts
 *
 * Handles multi-key sequences like "G then O" for navigation.
 * Common patterns:
 * - G + [key] = Go to page
 * - C + [key] = Create new item
 */

"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SequenceState {
  prefix: string | null;
  timestamp: number;
}

const SEQUENCE_TIMEOUT = 1000; // 1 second to complete sequence

export function useSequentialShortcuts() {
  const router = useRouter();
  const [sequenceState, setSequenceState] = useState<SequenceState>({
    prefix: null,
    timestamp: 0,
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except shift for uppercase)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const now = Date.now();

      // Check if we're in a sequence
      if (sequenceState.prefix) {
        // Check if sequence timed out
        if (now - sequenceState.timestamp > SEQUENCE_TIMEOUT) {
          setSequenceState({ prefix: null, timestamp: 0 });
          // Fall through to check if this is a new prefix
        } else {
          // Complete the sequence
          event.preventDefault();
          handleSequenceComplete(sequenceState.prefix, key);
          setSequenceState({ prefix: null, timestamp: 0 });
          return;
        }
      }

      // Check if this is a sequence prefix
      if (key === "g" || key === "c") {
        event.preventDefault();
        setSequenceState({ prefix: key, timestamp: now });
      }
    },
    [sequenceState, router]
  );

  const handleSequenceComplete = useCallback(
    (prefix: string, key: string) => {
      // Navigation shortcuts (G + key)
      if (prefix === "g") {
        switch (key) {
          case "d":
            router.push("/dashboard");
            break;
          case "o":
            router.push("/orders");
            break;
          case "p":
            router.push("/products");
            break;
          case "c":
            router.push("/customers");
            break;
          case "i":
            router.push("/inventory");
            break;
          case "b":
            router.push("/backorders");
            break;
          case "t":
            router.push("/containers");
            break;
          case "s":
            router.push("/settings");
            break;
        }
      }

      // Create shortcuts (C + key)
      if (prefix === "c") {
        switch (key) {
          case "o":
            router.push("/orders/new");
            break;
          case "p":
            router.push("/products/new");
            break;
          case "c":
            router.push("/customers/new");
            break;
          case "q":
            router.push("/quotes/new");
            break;
        }
      }
    },
    [router]
  );

  // Clear sequence state on timeout
  useEffect(() => {
    if (!sequenceState.prefix) return;

    const timer = setTimeout(() => {
      setSequenceState({ prefix: null, timestamp: 0 });
    }, SEQUENCE_TIMEOUT);

    return () => clearTimeout(timer);
  }, [sequenceState]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    sequenceState,
  };
}
