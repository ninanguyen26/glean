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
  eggshells: require('../../assets/sprites/eggshells.png'),
  'coffee-grounds': require('../../assets/sprites/coffee-grounds.png'),
  leaves: require('../../assets/sprites/leaves.png'),
  'office-paper': require('../../assets/sprites/office-paper.png'),
  'tin-can': require('../../assets/sprites/tin-can.png'),
  'foam-cup': require('../../assets/sprites/foam-cup.png'),
  'detergent-bottle': require('../../assets/sprites/detergent-full.png'),
  'chip-bag': require('../../assets/sprites/chip-bag.png'),
  'cig-butt': require('../../assets/sprites/cig-butt.png'),
  'cig-butts': require('../../assets/sprites/cig-butts.png'),
  'broken-pen': require('../../assets/sprites/broken-pen.png'),
  'pizza-box': require('../../assets/sprites/pizza-box.png'),
  'yard-debris': require('../../assets/sprites/yard-debris.png'),
  'corn-husks': require('../../assets/sprites/corn-husks.png'),
  bouquet: require('../../assets/sprites/bouquet.png'),
  'coffee-filter': require('../../assets/sprites/coffee-filter.png'),
  napkin: require('../../assets/sprites/napkin.png'),
  chopsticks: require('../../assets/sprites/chopsticks.png'),
  'sixpack-carrier': require('../../assets/sprites/sixpack-carrier.png'),
  'junk-mail': require('../../assets/sprites/junk-mail.png'),
  'yogurt-tub': require('../../assets/sprites/yogurt-tub.png'),
  'cereal-box': require('../../assets/sprites/cereal-box.png'),
  'soup-can': require('../../assets/sprites/soup-can.png'),
  'grocery-bag': require('../../assets/sprites/grocery-bag.png'),
  'plant-pot': require('../../assets/sprites/plant-pot.png'),
  'egg-carton': require('../../assets/sprites/egg-carton.png'),
  'coffee-bag': require('../../assets/sprites/coffee-bag.png'),
  clamshell: require('../../assets/sprites/clamshell.png'),
  'black-tray': require('../../assets/sprites/black-tray.png'),
  'film-wrap': require('../../assets/sprites/film-wrap.png'),
  razor: require('../../assets/sprites/razor.png'),
  straw: require('../../assets/sprites/straw.png'),
  'candy-wrapper': require('../../assets/sprites/candy-wrapper.png'),
  headphones: require('../../assets/sprites/headphones.png'),
  'wet-newspaper': require('../../assets/sprites/uni-wet-news.png'),
  'wine-bottle': require('../../assets/sprites/wine-full.png'),
  // fall seasonal (15 items, incl. the -1 pair entries)
  acorn: require('../../assets/sprites/seasonal/fall/acorn.png'),
  'aluminum-pie-tin': require('../../assets/sprites/seasonal/fall/aluminum-pie-tin.png'),
  'broken-rake': require('../../assets/sprites/seasonal/fall/broken-rake.png'),
  'candy-wrappers': require('../../assets/sprites/seasonal/fall/candy-wrappers.png'),
  'cider-jug': require('../../assets/sprites/seasonal/fall/cider-jug.png'),
  'cracked-bucket': require('../../assets/sprites/seasonal/fall/cracked-bucket.png'),
  'dead-mums': require('../../assets/sprites/seasonal/fall/dead-mums.png'),
  'fake-web': require('../../assets/sprites/seasonal/fall/fake-web.png'),
  'halloween-mask': require('../../assets/sprites/seasonal/fall/halloween-mask-1.png'),
  'halloween-mask-1': require('../../assets/sprites/seasonal/fall/halloween-mask.png'),
  'mini-gourd': require('../../assets/sprites/seasonal/fall/mini-gourd.png'),
  'mini-gourd-1': require('../../assets/sprites/seasonal/fall/mini-gourd-1.png'),
  'pumpkin-guts': require('../../assets/sprites/seasonal/fall/pumpkin-guts.png'),
  'pumpkin-pie': require('../../assets/sprites/seasonal/fall/pumpkin-pie.png'),
  'turkey-bone': require('../../assets/sprites/seasonal/fall/turkey-bone.png'),
  // portland (9 items)
  umbrella: require('../../assets/sprites/cities/portland/umbrella.png'),
  'rain-boot': require('../../assets/sprites/cities/portland/rain-boot.png'),
  growler: require('../../assets/sprites/cities/portland/growler.png'),
  'coffee-cup': require('../../assets/sprites/cities/portland/coffee-cup.png'),
  'voodoo-box': require('../../assets/sprites/cities/portland/voodoo-box.png'),
  'pla-container': require('../../assets/sprites/cities/portland/pla-container.png'),
  'wet-news': require('../../assets/sprites/cities/portland/wet-news.png'),
  'pack-rings': require('../../assets/sprites/cities/portland/pack-rings.png'),
  'bike-tube': require('../../assets/sprites/cities/portland/bike-tube.png'),
};

export const BIN_SPRITES: Record<string, any> = {
  recycle: require('../../assets/sprites/bin-recycle.png'),
  compost: require('../../assets/sprites/bin-compost.png'),
  landfill: require('../../assets/sprites/bin-landfill.png'),
};

export const BELT_BG = require('../../assets/extra/belt.png');

export const HOME_BG = require('../../assets/background/home-background.png');

// home background animation: 8-frame MRF loop
export const HOME_BG_FRAMES = [
  require('../../assets/background/mrf_home_frames/frame_01.png'),
  require('../../assets/background/mrf_home_frames/frame_02.png'),
  require('../../assets/background/mrf_home_frames/frame_03.png'),
  require('../../assets/background/mrf_home_frames/frame_04.png'),
  require('../../assets/background/mrf_home_frames/frame_05.png'),
  require('../../assets/background/mrf_home_frames/frame_06.png'),
  require('../../assets/background/mrf_home_frames/frame_07.png'),
  require('../../assets/background/mrf_home_frames/frame_08.png'),
];

export const PORTLAND_BG = require('../../assets/background/portland-bg.png');

export const ICON_ALBUM = require('../../assets/icons/album.png');
export const ICON_MAP = require('../../assets/icons/map.png');
export const ICON_PLAY = require('../../assets/icons/play.png');
export const ICON_START = require('../../assets/icons/start.png');
export const ICON_RULEBOOK = require('../../assets/icons/rulebook-icon.png');
export const ICON_COIN = require('../../assets/icons/coin-icon.png');
export const ICON_STAR = require('../../assets/icons/star-icon.png');
export const ICON_STAR_OUTLINE = require('../../assets/icons/star-outline.png');
export const ICON_BACK = require('../../assets/icons/back-icon.png');
export const ICON_PAUSE = require('../../assets/icons/pause-icon.png');
export const ICON_STREAK = require('../../assets/icons/streak-icon.png');
export const ICON_SPRING = require('../../assets/icons/spring.png');
export const ICON_SUMMER = require('../../assets/icons/summer.png');
export const ICON_AUTUMN = require('../../assets/icons/autumn.png');
export const ICON_WINTER = require('../../assets/icons/winter.png');
export const ICON_RESUME = require('../../assets/icons/resume.png');
export const ICON_QUIT = require('../../assets/icons/quit.png');
export const ICON_PIN = require('../../assets/icons/pin.png');
export const ICON_SETTINGS = require('../../assets/icons/settings-icon.png');
export const ICON_MUSIC = require('../../assets/icons/music-icon.png');
export const ICON_SOUND = require('../../assets/icons/sound-icon.png');
export const ICON_HAPTICS = require('../../assets/icons/haptics-icon.png');
export const ICON_FUNFACT = require('../../assets/icons/funfact-icon.png');

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
// disassembly modal layers: coffee cup (lid-sleeve mechanic)
export const COFFEE_CUP_WHOLE = require('../../assets/sprites/cities/portland/coffee-cup.png');
export const COFFEE_CUP_BODY = require('../../assets/sprites/cities/portland/coffee-cup-body.png');
export const COFFEE_CUP_LID = require('../../assets/sprites/cities/portland/coffee-cup-lid.png');
export const COFFEE_CUP_SLEEVE = require('../../assets/sprites/cities/portland/coffee-cup-sleeve.png');
export const COFFEE_CUP_NO_LID = require('../../assets/sprites/cities/portland/coffee-cup-no-lid.png');
export const COFFEE_CUP_NO_SLEEVE = require('../../assets/sprites/cities/portland/coffee-cup-no-sleeve.png'); 
// disassembly modal layers: wine bottle (capsule mechanic)
export const WINE_FULL = require('../../assets/sprites/wine-full.png');
export const WINE_CAPSULE = require('../../assets/sprites/wine-capsule.png');
export const WINE_NO_CAPSULE = require('../../assets/sprites/wine-no-capsule.png');
// disassembly modal layers: detergent bottle (twist mechanic)
export const DETERGENT_FULL = require('../../assets/sprites/detergent-full.png');
export const DETERGENT_CAP = require('../../assets/sprites/detergent-cap.png');
export const DETERGENT_BODY = require('../../assets/sprites/detergent-body.png');
