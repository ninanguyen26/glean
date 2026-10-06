import React from 'react';
import { Canvas, RoundedRect } from '@shopify/react-native-skia';
import { C, BW, BH } from './effects';

/* Small static bottle for the belt. Layered shapes, no animation. */
export function BeltBottle() {
  return (
    <Canvas style={{ width: 90, height: 130 }}>
      <RoundedRect x={18} y={30} width={54} height={88} r={14} color={C.bottle} />
      <RoundedRect x={18} y={30} width={54} height={88} r={14} color={C.bottleInk} style="stroke" strokeWidth={4} />
      <RoundedRect x={30} y={12} width={30} height={20} r={7} color={C.cap} />
      <RoundedRect x={22} y={58} width={46} height={30} r={6} color={C.wrapper} />
    </Canvas>
  );
}

/*
 * Big bottle for the disassembly modal. The cap wiggle + wrapper peel are
 * driven by Reanimated shared values passed as TOP-LEVEL Skia props —
 * the v2-safe pattern (never nest shared values inside transform arrays).
 */
export function ModalBottle({
  capX,
  capY,
  wrapH,
  flapY,
  flapH,
  capGone,
  wrapGone,
}: {
  capX: any;
  capY: any;
  wrapH: any;
  flapY: any;
  flapH: any;
  capGone: boolean;
  wrapGone: boolean;
}) {
  return (
    <Canvas style={{ width: 190, height: 380 }}>
      {/* body */}
      <RoundedRect x={20} y={60} width={BW} height={BH} r={30} color={C.bottle} />
      <RoundedRect x={20} y={60} width={BW} height={BH} r={30} color={C.bottleInk} style="stroke" strokeWidth={5} />
      {/* neck */}
      <RoundedRect x={80} y={44} width={30} height={20} r={6} color={C.bottleInk} />
      {/* cap (wiggles while twisting) */}
      {!capGone && <RoundedRect x={capX} y={capY} width={60} height={38} r={11} color={C.cap} />}
      {/* wrapper band shrinks as you peel; flap grows beneath it */}
      {!wrapGone && (
        <>
          <RoundedRect x={28} y={150} width={134} height={wrapH} r={10} color={C.wrapper} />
          <RoundedRect x={28} y={flapY} width={134} height={flapH} r={10} color={C.wrapper} opacity={0.55} />
        </>
      )}
    </Canvas>
  );
}
