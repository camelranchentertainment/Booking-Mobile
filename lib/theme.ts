/**
 * Camel Ranch design tokens for the mobile app.
 *
 * The look is the brand navy/orange/cream system from the web app with a
 * 1970s layer on top: Shrikhand "groovy" display type with a stacked
 * mustard -> orange -> rust drop shadow, Bebas Neue labels, and three-band
 * retro stripes. Every screen pulls colors, type and spacing from here;
 * nothing in a screen file should hard-code a hex value or font family.
 */

/** Raw palette. Screens should prefer the semantic aliases in `colors`. */
const palette = {
  navy950: '#0A1120',
  navy900: '#0E1628', // brand background
  navy800: '#141E36',
  navy700: '#1E2A44',
  navy600: '#263453',
  navy500: '#34446A',
  cream: '#F5EDD9', // brand cream
  creamDim: '#E9DCBC',
  orange: '#E8602A', // brand orange
  mustard: '#ECA834',
  rust: '#B0401E',
  brown: '#5C301A',
  avocado: '#8A8C3C',
  teal: '#347876',
  slate: '#96A5BE',
  slateDim: '#7183A3',
  green: '#56AA60',
  sky: '#6E96C8',
  red: '#E85A5A',
} as const;

export const colors = {
  background: palette.navy900,
  backgroundDeep: palette.navy950,
  surface: palette.navy700,
  surfaceRaised: palette.navy600,
  border: palette.navy500,
  tabBar: palette.navy800,

  onBackground: palette.cream,
  onSurface: palette.cream,
  textMuted: palette.slate,
  textSubtle: palette.slateDim,

  interactive: palette.orange,
  onInteractive: palette.navy900,
  highlight: palette.mustard,
  danger: palette.red,

  // retro accents
  cream: palette.cream,
  mustard: palette.mustard,
  orange: palette.orange,
  rust: palette.rust,
  brown: palette.brown,
  avocado: palette.avocado,
  teal: palette.teal,

  // booking pipeline
  statusConfirmed: palette.green,
  statusHold: palette.mustard,
  statusPitch: palette.sky,
  statusNegotiating: palette.orange,
  statusContract: palette.teal,
  statusDone: palette.navy500,
  statusCancelled: palette.red,
} as const;

/** The three 70s stripe colors, top to bottom. */
export const retroStripe = [colors.mustard, colors.orange, colors.rust] as const;

/** Avatar fills for roster initials — cycles through the 70s accents. */
export const avatarColors = [colors.orange, colors.teal, colors.avocado, colors.mustard, colors.rust] as const;

export const fonts = {
  groovy: 'Shrikhand_400Regular',
  label: 'BebasNeue_400Regular',
  body: 'Inter_400Regular',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Type scale. Line heights are explicit so Shrikhand's tall ascenders never clip. */
export const type = {
  display: { fontFamily: fonts.groovy, fontSize: 34, lineHeight: 46 },
  title: { fontFamily: fonts.groovy, fontSize: 28, lineHeight: 38 },
  heading: { fontFamily: fonts.groovy, fontSize: 22, lineHeight: 30 },
  eyebrow: { fontFamily: fonts.label, fontSize: 16, lineHeight: 18, letterSpacing: 1.5 },
  label: { fontFamily: fonts.label, fontSize: 18, lineHeight: 20, letterSpacing: 1 },
  time: { fontFamily: fonts.label, fontSize: 22, lineHeight: 24, letterSpacing: 0.5 },
  lg: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22 },
  md: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 20 },
  base: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  sm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  xs: { fontFamily: fonts.bodySemibold, fontSize: 11, lineHeight: 14 },
} as const;

/** 4px base unit. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 48 } as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 22, pill: 999 } as const;

/** Minimum touch target (Apple HIG 44pt / Material 48dp — we use 48). */
export const touchTarget = 48;
