import { useCallback, useRef } from 'react';

/**
 * For a list that reloads when its page or filters change: call beginLoad() at
 * the start of each load and check the returned isCurrent() after every await.
 * A load that a newer one has overtaken must write nothing, or a slow response
 * for the old page or filter replaces the rows the user just asked for.
 */
export function useLatestLoad(): () => () => boolean {
  const generation = useRef(0);
  return useCallback(() => {
    const mine = ++generation.current;
    return () => mine === generation.current;
  }, []);
}
