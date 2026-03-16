/**
 * Online Status Hook
 *
 * React hook for monitoring network connectivity.
 */

import { useState, useEffect } from "react";
import { onlineStatusDetector } from "@/lib/offline/detector";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(onlineStatusDetector.isOnline);

  useEffect(() => {
    // Subscribe to online status changes
    const unsubscribe = onlineStatusDetector.subscribe((online) => {
      setIsOnline(online);
    });

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  return isOnline;
}
