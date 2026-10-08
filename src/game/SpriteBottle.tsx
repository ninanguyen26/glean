import { Image, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import {
  BOTTLE_BODY,
  BOTTLE_CAP,
  BOTTLE_NO_CAP,
  BOTTLE_WRAP_PEEL,
  RED_BOTTLE_BODY,
  RED_BOTTLE_CAP,
  RED_BOTTLE_NO_CAP,
  RED_BOTTLE_WRAP_PEEL,
} from "./sprites";

/*
 * Bottle modal: whole -> (twist cap) -> body -> (peel label) -> crumpled.
 * Uses only the 4 finalized sprites. Cap is layered over the whole for
 * the twist; after twist the body renders; the label area is circled
 * (UI) and peeling renders the crumpled wrapper.
 */
const STAGE_W = 250;
const STAGE_H = 500;
const BODY_Y = 20;
const LAYER = {
  position: "absolute",
  left: 0,
  top: BODY_Y,
  width: STAGE_W,
  height: STAGE_H,
} as const;

// tight crops: whole 472x1181 -> 200x500 @ x=25; cap 301x217 sits on neck
export const CAP_W = 255;
export const CAP_H = CAP_W * (217 / 301);
const CAP_X = 121 - CAP_W / 2;
const CAP_Y = 144;

// label band on the whole: y ~38-59% -> circle UI center
const LABEL_CY = STAGE_H * 0.485 + 20;
const CIRCLE_W = 138;
const CIRCLE_H = 96;

// crumpled wrapper (1178x580) shown at the label spot during peel
const CRUM_W = 132;
const CRUM_H = CRUM_W * (580 / 1178);

export function SpriteBottle({
  twistProg,
  capWig,
  peelProg,
  capGone,
  wrapGone,
  variant = "blue",
}: {
  twistProg: { value: number };
  capWig: { value: number };
  peelProg: { value: number };
  capGone: boolean;
  wrapGone: boolean;
  variant?: "blue" | "red";
}) {
  const isRed = variant === "red";
  const S_BODY = isRed ? RED_BOTTLE_BODY : BOTTLE_BODY;
  const S_CAP = isRed ? RED_BOTTLE_CAP : BOTTLE_CAP;
  const S_NO_CAP = isRed ? RED_BOTTLE_NO_CAP : BOTTLE_NO_CAP;
  const S_WRAP = isRed ? RED_BOTTLE_WRAP_PEEL : BOTTLE_WRAP_PEEL;
  const capStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: capWig.value },
      { translateY: -twistProg.value * 14 },
    ],
  }));
  const circleStyle = useAnimatedStyle(() => ({
    opacity: 1 - peelProg.value,
  }));
  const crumpledStyle = useAnimatedStyle(() => ({
    opacity: peelProg.value,
    transform: [{ scale: 0.6 + peelProg.value * 0.4 }],
  }));
  // base: no-cap (label on) until peeled, then body (clean)
  const useNoCap = !wrapGone;
  return (
    <View style={{ width: STAGE_W, height: STAGE_H }}>
      {useNoCap ? (
        <Image source={S_NO_CAP} style={LAYER} resizeMode="contain" />
      ) : (
        <Image source={S_BODY} style={LAYER} resizeMode="contain" />
      )}
      {!capGone && (
        <Animated.Image
          source={S_CAP}
          style={[
            {
              position: "absolute",
              left: CAP_X,
              top: CAP_Y,
              width: CAP_W,
              height: CAP_H,
            },
            capStyle,
          ]}
          resizeMode="contain"
        />
      )}
      {capGone && !wrapGone && (
        <Animated.Image
          source={S_WRAP}
          style={[
            {
              position: "absolute",
              left: (STAGE_W - CRUM_W) / 2,
              top: LABEL_CY - CRUM_H / 2,
              width: CRUM_W,
              height: CRUM_H,
            },
            crumpledStyle,
          ]}
          resizeMode="contain"
        />
      )}
    </View>
  );
}
