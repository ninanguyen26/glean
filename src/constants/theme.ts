export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
};

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = {
  mono: 'BalsamiqSans_400Regular',
  sans: 'System',
};

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
};

/* Glean palette — extracted from the icon set (album/map/play/start) */
export const palette = {
  outline: '#6E1E1E',    // dark red-brown outline
  sage: '#93B192',       // play/start button green
  cream: '#FFF6E5',      // play triangle, text, pages
  gold: '#E8A13D',       // book accents, stars
  sky: '#8EC9DE',        // map river, photo sky
  leaf: '#9DBE8C',       // map land, photo hills
  sand: '#F2E3C2',       // map paper
  clay: '#C96F4A',       // book cover, map pin
  bark: '#4A3F35',       // dark brown text
  fog: '#8A7B68',        // muted brown text
  paper: '#FAF3E8',      // warm background
  parchment: '#FCF3DC', // album modal card
  cocoa: '#6B3E2A',      // album modal border
  butter: '#F7E9C9',     // album title pill
  oat: '#F8ECD2',        // album tile
  milk: '#FFFDF8',       // near-white text on dark
  scrim: 'rgba(46,36,28,0.6)',   // modal backdrop dim
  faint: 'rgba(74,63,53,0.28)',  // soft outline
  river: '#5B9BD5',      // uncommon rarity
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 30,
  hero: 38,
};

export const fontWeight = {
  regular: '400' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
  black: '900' as const,
};
