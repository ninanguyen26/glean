/*
 * Phase 8: static sprite registry. Metro needs literal require() calls,
 * so every production sprite is listed here once. Items without an entry
 * fall back to the code-drawn ItemGlyph shape.
 */

declare const require: any;

export const ITEM_SPRITES: Record<string, any> = {
  banana: require('../../assets/sprites/banana-peel.png'),
  apple: require('../../assets/sprites/apple-core.png'),
  newspaper: require('../../assets/sprites/newspaper.png'),
  'cardboard-box': require('../../assets/sprites/cardboard-box.png'),
  'glass-jar': require('../../assets/sprites/glass-jar.png'),
  'alu-can': require('../../assets/sprites/soda-can.png'),
  bottle: require('../../assets/sprites/bottle-whole.png'),
};

export const BIN_SPRITES: Record<string, any> = {
  recycle: require('../../assets/sprites/bin-recycle.png'),
  compost: require('../../assets/sprites/bin-compost.png'),
  landfill: require('../../assets/sprites/bin-landfill.png'),
};

// disassembly modal layers: your finalized sprites, no extras
export const BOTTLE_BODY = require('../../assets/sprites/bottle-body.png');
export const BOTTLE_CAP = require('../../assets/sprites/bottle-cap.png');
export const BOTTLE_WHOLE = require('../../assets/sprites/bottle-whole.png');
export const BOTTLE_NO_CAP = require('../../assets/sprites/bottle-no-cap.png');
export const BOTTLE_WRAP_PEEL = require('../../assets/sprites/bottle-wrapper.png');
// chips reuse the same 4 files
export const BOTTLE_CAP_CHIP = require('../../assets/sprites/bottle-cap.png');
export const BOTTLE_WRAP_CHIP = require('../../assets/sprites/bottle-wrapper.png');
