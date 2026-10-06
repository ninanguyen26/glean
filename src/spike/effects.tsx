import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export const { width: SW, height: SH } = Dimensions.get('window');

export const C = {
  bg: '#FAF3E8',
  ink: '#4A3F35',
  sub: '#8A7B68',
  belt: '#4A4239',
  bottle: '#CFE8F2',
  bottleInk: '#6FA3B8',
  cap: '#E8735A',
  wrapper: '#9DBE8C',
  pet: '#7FB3D5',
  plastic: '#E8735A',
  other: '#A8A29E',
  gold: '#E8A13D',
};

// Modal bottle geometry (modal content = full-screen coords)
export const BW = 150;
export const BH = 240;
export const BX = SW / 2 - BW / 2;
export const BY = SH * 0.3;

// Mini-bin geometry (must match the bins row layout in SpikeScreen)
export const BIN_W = 124;
export const BIN_H = 112;
export const BIN_GAP = 6;
export const BIN_BOTTOM = 100;
export const binX = (i: number) => (SW - (3 * BIN_W + 2 * BIN_GAP)) / 2 + i * (BIN_W + BIN_GAP);
export const binY = SH - BIN_BOTTOM - BIN_H;

/* Pulsing instruction ring (Assemble-with-Care style "touch here") */
export function Pulse({ size, color }: { size: number; color: string }) {
  const o = useSharedValue(1);
  const s = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(
      withTiming(0.2, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    s.value = withRepeat(
      withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: s.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color }, st]}
    />
  );
}

/* One particle dot of a sort burst */
function Dot({ x, y, i }: { x: number; y: number; i: number }) {
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const op = useSharedValue(1);
  useEffect(() => {
    const a = (i / 10) * Math.PI * 2 + 0.35;
    const d = 42 + (i % 3) * 20;
    px.value = withTiming(Math.cos(a) * d, { duration: 480, easing: Easing.out(Easing.ease) });
    py.value = withTiming(Math.sin(a) * d, { duration: 480, easing: Easing.out(Easing.ease) });
    op.value = withTiming(0, { duration: 480 });
  }, []);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: px.value }, { translateY: py.value }],
    opacity: op.value,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - 5, top: y - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold }, st]}
    />
  );
}

export function Burst({ x, y }: { x: number; y: number }) {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <Dot key={i} x={x} y={y} i={i} />
      ))}
    </>
  );
}
