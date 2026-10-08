import { Image, View } from "react-native";
import { WINE_FULL, WINE_NO_CAPSULE } from "./sprites";

/*
 * Wine-bottle modal base. Pure image swaps, one per state:
 * - capsule on: wine-full.png
 * - capsule off: wine-no-capsule.png
 *
 * Tune sizes here: WINE_STAGE_* for the bottle on stage,
 * WINE_CAPSULE_* for the popped capsule piece and the sort chip.
 */
export const WINE_STAGE_W = 258.75;
export const WINE_STAGE_H = 414;

export const WINE_CAPSULE_W = 82.5;
export const WINE_CAPSULE_H = 105;

export function SpriteWine({ capsuleOff }: { capsuleOff: boolean }) {
  const src = capsuleOff ? WINE_NO_CAPSULE : WINE_FULL;
  return (
    <View style={{ width: WINE_STAGE_W, height: WINE_STAGE_H }}>
      <Image
        source={src}
        style={{ width: WINE_STAGE_W, height: WINE_STAGE_H }}
        resizeMode="contain"
      />
    </View>
  );
}
