import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useImageLoadGate({
  keys,
  onReady,
  onProgress,
}: {
  keys: string[];
  onReady?: () => void;
  onProgress?: (done: number, total: number) => void;
}) {
  const stableKey = keys.join("|");
  const requiredKeys = useMemo(() => Array.from(new Set(keys)), [stableKey]);
  const readySent = useRef<string | null>(null);
  const [loadedState, setLoadedState] = useState<{
    gate: string;
    loaded: Set<string>;
  }>(() => ({ gate: stableKey, loaded: new Set() }));

  const loadedImages =
    loadedState.gate === stableKey ? loadedState.loaded : new Set<string>();

  const markLoaded = useCallback((key: string) => {
    setLoadedState((prev) => {
      const loaded = prev.gate === stableKey ? prev.loaded : new Set<string>();
      if (loaded.has(key) && prev.gate === stableKey) return prev;
      const next = new Set(loaded);
      next.add(key);
      return { gate: stableKey, loaded: next };
    });
  }, [stableKey]);

  useEffect(() => {
    const total = requiredKeys.length;
    const done = requiredKeys.filter((key) => loadedImages.has(key)).length;
    if (total === 0) return;
    onProgress?.(done, total);
    if (done >= total && readySent.current !== stableKey) {
      readySent.current = stableKey;
      onReady?.();
    }
  }, [loadedImages, onProgress, onReady, requiredKeys, stableKey]);

  return markLoaded;
}
