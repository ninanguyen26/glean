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
  'bottle-red': require('../../assets/sprites/bottle-whole-1.png'),
  // fall seasonal (15 items, incl. the -1 pair entries)
  acorn: require('../../assets/sprites/seasonal/fall/acorn.png'),
  'aluminum-pie-tin': require('../../assets/sprites/seasonal/fall/aluminum-pie-tin.png'),
  'broken-rake': require('../../assets/sprites/seasonal/fall/broken-rake.png'),
  'candy-wrappers': require('../../assets/sprites/seasonal/fall/candy-wrappers.png'),
  'cider-jug': require('../../assets/sprites/seasonal/fall/cider-jug.png'),
  'cracked-bucket': require('../../assets/sprites/seasonal/fall/cracked-bucket.png'),
  'dead-mums': require('../../assets/sprites/seasonal/fall/dead-mums.png'),
  'fake-web': require('../../assets/sprites/seasonal/fall/fake-web.png'),
  'halloween-mask': require('../../assets/sprites/seasonal/fall/halloween-mask.png'),
  'halloween-mask-1': require('../../assets/sprites/seasonal/fall/halloween-mask-1.png'),
  'mini-gourd': require('../../assets/sprites/seasonal/fall/mini-gourd.png'),
  'mini-gourd-1': require('../../assets/sprites/seasonal/fall/mini-gourd-1.png'),
  'pumpkin-guts': require('../../assets/sprites/seasonal/fall/pumpkin-guts.png'),
  'pumpkin-pie': require('../../assets/sprites/seasonal/fall/pumpkin-pie.png'),
  'turkey-bone': require('../../assets/sprites/seasonal/fall/turkey-bone.png'),
};

export const BIN_SPRITES: Record<string, any> = {
  recycle: require('../../assets/sprites/bin-recycle.png'),
  compost: require('../../assets/sprites/bin-compost.png'),
  landfill: require('../../assets/sprites/bin-landfill.png'),
};

export const BELT_BG = require('../../assets/extra/belt.png');

export const HOME_BG = require('../../assets/background/home-background.png');

export const PORTLAND_BG = require('../../assets/background/portland-bg.png');

export const ICON_ALBUM = require('../../assets/icons/album.png');
export const ICON_MAP = require('../../assets/icons/map.png');
export const ICON_PLAY = require('../../assets/icons/play.png');
export const ICON_START = require('../../assets/icons/start.png');
export const ICON_RULEBOOK = require('../../assets/icons/rulebook-icon.png');

// disassembly modal layers: blue bottle
export const BOTTLE_BODY = require('../../assets/sprites/bottle-body.png');
export const BOTTLE_CAP = require('../../assets/sprites/bottle-cap.png');
export const BOTTLE_WHOLE = require('../../assets/sprites/bottle-whole.png');
export const BOTTLE_NO_CAP = require('../../assets/sprites/bottle-no-cap.png');
export const BOTTLE_WRAP_PEEL = require('../../assets/sprites/bottle-wrapper.png');
// disassembly modal layers: red bottle (your -1 files)
export const RED_BOTTLE_BODY = require('../../assets/sprites/bottle-body-1.png');
export const RED_BOTTLE_CAP = require('../../assets/sprites/bottle-cap-1.png');
export const RED_BOTTLE_WHOLE = require('../../assets/sprites/bottle-whole-1.png');
export const RED_BOTTLE_NO_CAP = require('../../assets/sprites/bottle-no-cap-1.png');
export const RED_BOTTLE_WRAP_PEEL = require('../../assets/sprites/bottle-wrapper-1.png');
// chips reuse the same 4 files
export const BOTTLE_CAP_CHIP = require('../../assets/sprites/bottle-cap.png');
export const BOTTLE_WRAP_CHIP = require('../../assets/sprites/bottle-wrapper.png'); 
