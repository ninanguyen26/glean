import React from 'react';
import { View, Image } from 'react-native';
import { C } from '../spike/effects';
import { ItemDef } from './items';
import { ITEM_SPRITES } from './sprites';

/*
 * Phase 8: items with a production sprite render the PNG; everything else
 * keeps the code-drawn placeholder shape. silhouette=true forces the
 * shape path (album undiscovered state) so the sprite stays a mystery.
 */
export function ItemGlyph({
  def,
  size = 56,
  silhouette = false,
}: {
  def: ItemDef;
  size?: number;
  silhouette?: boolean;
}) {
  const sprite = !silhouette ? ITEM_SPRITES[def.id] : undefined;
  if (sprite) {
    return <Image source={sprite} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  const base = {
    width: size,
    height: size,
    backgroundColor: def.color,
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
