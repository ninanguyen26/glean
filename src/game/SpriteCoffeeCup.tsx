import { Image, View } from "react-native";
import {
  COFFEE_CUP_BODY,
  COFFEE_CUP_NO_LID,
  COFFEE_CUP_NO_SLEEVE,
  COFFEE_CUP_WHOLE,
} from "./sprites";

/*
 * Coffee-cup modal base. Pure image swaps, one per state:
 * - assembled (lid + sleeve on): coffee-cup.png
 * - lid off, sleeve on: coffee-cup-no-lid.png
 * - sleeve off, lid on: coffee-cup-no-sleeve.png
 * - both off: coffee-cup-body.png
 */
export const CUP_STAGE = 240;

export function SpriteCoffeeCup({
  lidOff,
  sleeveOff,
}: {
  lidOff: boolean;
  sleeveOff: boolean;
}) {
  const src =
    !lidOff && !sleeveOff
      ? COFFEE_CUP_WHOLE
      : lidOff && !sleeveOff
        ? COFFEE_CUP_NO_LID
        : !lidOff && sleeveOff
          ? COFFEE_CUP_NO_SLEEVE
          : COFFEE_CUP_BODY;
  return (
    <View style={{ width: CUP_STAGE, height: CUP_STAGE }}>
      <Image
        source={src}
        style={{
          width: CUP_STAGE,
          height: CUP_STAGE,
          transform: src === COFFEE_CUP_BODY ? [{ translateX: 3 }] : [],
        }}
        resizeMode="contain"
      />
    </View>
  );
}
