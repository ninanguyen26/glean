import { Image, View } from "react-native";
import { DETERGENT_BODY, DETERGENT_FULL } from "./sprites";

/*
 * Detergent-bottle modal base. Pure image swaps, one per state:
 * - cap on: detergent-full.png
 * - cap off: detergent-body.png
 *
 * Tune sizes here: DETERGENT_STAGE_* for the bottle on stage,
 * DETERGENT_CAP_* for the popped cap piece and the sort chip.
 */
export const DETERGENT_STAGE_W = 260;
export const DETERGENT_STAGE_H = 380;

export const DETERGENT_CAP_W = 210;
export const DETERGENT_CAP_H = 210;

export function SpriteDetergent({ capOff }: { capOff: boolean }) {
  const src = capOff ? DETERGENT_BODY : DETERGENT_FULL;
  return (
    <View style={{ width: DETERGENT_STAGE_W, height: DETERGENT_STAGE_H }}>
      <Image
        source={src}
        style={{ width: DETERGENT_STAGE_W, height: DETERGENT_STAGE_H }}
        resizeMode="contain"
      />
    </View>
  );
}
