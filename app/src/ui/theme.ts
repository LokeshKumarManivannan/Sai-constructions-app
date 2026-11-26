/**
 * Sai Constructions look: blueprint blue (plans, trust) + site amber (helmets, progress)
 * on light concrete. Status colours always pair with an icon (UX rule 4).
 */
export const colors = {
  bg: '#EDF0F3', // concrete
  card: '#FFFFFF',
  text: '#17212B', // ink
  muted: '#5B6675', // slate
  border: '#D9DEE4',
  brand: '#1E3A5F', // blueprint
  brandDeep: '#142A45',
  brandText: '#FFFFFF',
  brandSoft: '#E3EAF3',
  accent: '#F2A900', // site amber
  accentSoft: '#FDF1CF',
  good: '#1B7F4C',
  goodBg: '#E2F3EA',
  warn: '#8A5A00',
  warnBg: '#FBEFD2',
  bad: '#B42318',
  badBg: '#FBE3E1',
};

export const space = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };

export const font = {
  small: 15,
  body: 17,
  title: 21,
  hero: 26,
  big: 34, // money amounts
};

/** Catamaran (Pria Ravichandran): one family drawn for Tamil and Latin together, with lining figures for money. */
export const family = {
  regular: 'Catamaran_400Regular',
  medium: 'Catamaran_500Medium',
  semibold: 'Catamaran_600SemiBold',
  bold: 'Catamaran_700Bold',
  heavy: 'Catamaran_800ExtraBold',
};

export const radius = { hero: 20, card: 14, control: 12, pill: 999 };

export const minTouch = 52; // buttons ≥ 48 px
