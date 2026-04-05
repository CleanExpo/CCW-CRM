'use client';
import { useEffect, useRef, useCallback } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number; // default 6
  maxIntervalMs?: number; // default 100ms
}

/**
 * Captures rapid keystrokes from a hardware barcode scanner.
 *
 * Hardware scanners emit characters in rapid succession (< 100 ms apart)
 * and terminate with an Enter key. This hook buffers those characters and
 * fires onScan when Enter is received, as long as the accumulated string
 * meets minLength.
 *
 * The hook attaches a global `keydown` listener so the user does not need
 * to focus a specific input element — the scanner can fire from anywhere
 * on the page.
 */
export function useBarcodeScanner({
  onScan,
  minLength = 6,
  maxIntervalMs = 100,
}: BarcodeScannerOptions): void {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLast = now - lastKeyTime.current;

      // If the gap is too large the user is typing manually — reset buffer
      if (timeSinceLast > maxIntervalMs) {
        buffer.current = '';
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (buffer.current.length >= minLength) {
          onScan(buffer.current);
        }
        buffer.current = '';
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        buffer.current += e.key;
      }
    },
    [onScan, minLength, maxIntervalMs]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
