import React from 'react';
import { View, Image } from 'react-native';
import { C } from '../spike/effects';
import { palette } from '../constants/theme';
import { ItemDef } from './items';
import { ITEM_SPRITES } from './sprites';

/*
 * Phase 8: items with a production sprite render the PNG; everything else
 * keeps the code-drawn placeholder shape. silhouette=true (album
 * undiscovered state) renders the item's own shape as a dark silhouette —
 * the real sprite tinted dark when one exists, else a dark shape.
 */
export function ItemGlyph({
  def,
  size = 56,
  silhouette = false,
  sprite,
}: {
  def: ItemDef;
  size?: number;
  silhouette?: boolean;
  sprite?: any;
}) {
  const src = sprite ?? ITEM_SPRITES[def.id];
  if (src) {
    return (
      <Image
        source={src}
        style={{
          width: size,
          height: size,
          ...(silhouette ? { tintColor: palette.bark } : {}),
        }}
        resizeMode="contain"
      />
    );
  }
  const base = {
    width: size,
    height: size,
    backgroundColor: silhouette ? palette.bark : def.color,
    borderWidth: 3,
    borderColor: 'rgba(74,63,53,0.35)',
  };
  if (def.shape === 'circle') return <View style={[base, { borderRadius: size / 2 }]} />;
  if (def.shape === 'diamond')
    return <View style={[base, { borderRadius: 10, transform: [{ rotate: '45deg' }, { scale: 0.8 }] }]} />;
  if (def.complex)
    return (
      <View style={[base, { borderRadius: 12, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }]}>
        <View style={{ width: size * 0.34, height: size * 0.2, borderRadius: 5, backgroundColor: C.cap }} />
      </View>
    );
  return <View style={[base, { borderRadius: 12 }]} />;
}
