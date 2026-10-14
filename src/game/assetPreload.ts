import { Asset } from "expo-asset";
import { Image as RNImage } from "react-native";

const loaded = new Set<any>();

export async function preloadAssets(
  sources: any[],
  onProgress?: (done: number, total: number) => void,
) {
  const unique = Array.from(new Set(sources)).filter(
    (source) => !loaded.has(source),
  );
  const total = unique.length;
  if (total === 0) {
    onProgress?.(1, 1);
    return;
  }

  let done = 0;
  onProgress?.(done, total);

  for (const source of unique) {
    try {
      await Asset.loadAsync(source);
      const uri = RNImage.resolveAssetSource(source)?.uri;
      if (uri) {
        await RNImage.prefetch(uri);
      }
      loaded.add(source);
    } catch {
      loaded.add(source);
    } finally {
      done += 1;
      onProgress?.(done, total);
    }
  }
}
