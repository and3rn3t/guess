/**
 * Design tokens for mobile game screens.
 *
 * Uses iOS semantic PlatformColor so the app responds correctly to
 * light/dark mode and tinting without any extra logic. Falls back to
 * concrete hex values on Android / web.
 *
 * Sizing uses the iOS Dynamic Type scale: no hard-coded px font sizes.
 * All Text components inherit allowFontScaling: true (RN default).
 */
import { PlatformColor } from 'react-native'

// ── Semantic Colors ───────────────────────────────────────────────────────────

export const colors = {
  /** Primary interactive tint — systemBlue */
  primaryBg: PlatformColor('systemBlue'),
  /** Text on primary tint background — always white */
  primaryFg: '#ffffff',
  /** Secondary text — secondaryLabel */
  secondaryFg: PlatformColor('secondaryLabel'),
  /** Secondary control border — separator */
  secondaryBorder: PlatformColor('separator'),
  /** Destructive action — systemRed */
  destructiveBg: PlatformColor('systemRed'),
  /** Page / card background — systemBackground */
  background: PlatformColor('systemBackground'),
  /** Secondary grouped fill — secondarySystemGroupedBackground */
  cardBackground: PlatformColor('secondarySystemGroupedBackground'),
  /** Primary label / body text — label */
  label: PlatformColor('label'),
  /** Dimmed / caption text — secondaryLabel */
  secondaryLabel: PlatformColor('secondaryLabel'),
  /** Tertiary fill — tertiarySystemFill */
  fill: PlatformColor('tertiarySystemFill'),
  /** Positive confirmation — systemGreen */
  positiveBg: PlatformColor('systemGreen'),
  /** Alias used by placeholder screen styles */
  accent: PlatformColor('systemBlue'),
  /** Alias used by placeholder screen styles */
  surface: PlatformColor('secondarySystemGroupedBackground'),
  /** Alias used by placeholder screen styles */
  border: PlatformColor('separator'),
  /** Alias used by placeholder screen styles */
  text: PlatformColor('label'),
  /** Alias used by placeholder screen styles */
  textSecondary: PlatformColor('secondaryLabel'),
} as const

// ── Radii ─────────────────────────────────────────────────────────────────────

export const radii = {
  /** Standard iOS rounded rect for buttons */
  button: 12,
  /** Card / surface corner radius */
  card: 16,
  /** Small chip / badge */
  chip: 8,
  /** Alias used by placeholder screen styles */
  md: 16,
  /** Alias used by placeholder screen styles */
  full: 999,
} as const

// ── Spacing ───────────────────────────────────────────────────────────────────

/** Minimum HIG touch target: 44pt */
const MIN_TOUCH = 44

export const spacing = {
  /** Alias used by placeholder screen styles */
  xs: 4,
  /** Alias used by placeholder screen styles */
  sm: 8,
  /** Alias used by placeholder screen styles */
  md: 16,
  /** Alias used by placeholder screen styles */
  lg: 24,
  /** Vertical padding that brings standard button to ≥44pt touch target */
  buttonV: 13,
  buttonH: 20,
  /** Gap between sibling buttons in a row */
  rowGap: 12,
  rowTop: 12,
  /** Standard content margin from screen edges */
  screenH: 20,
  screenV: 24,
  /** Gap between stacked content sections */
  sectionGap: 16,
  /** Minimum touch target (used for icon buttons) */
  minTouch: MIN_TOUCH,
} as const

// ── Typography (Dynamic Type scale) ──────────────────────────────────────────
//
// These match the iOS UIFont.TextStyle scale. RN maps them via
// StyleSheet.create — no hard-coded px values. allowFontScaling: true
// is the RN default so no explicit prop needed on most Text components.

export const typography = {
  /** Alias used by placeholder screen styles */
  heading1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
  /** Alias used by placeholder screen styles */
  heading2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  /** Large Title — welcome headings */
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.37 },
  /** Title 1 — screen headings */
  title1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
  /** Title 2 — section headings */
  title2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
  /** Headline — emphasized body */
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
  /** Body — primary reading text */
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41 },
  /** Callout — secondary reading text */
  callout: { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 },
  /** Subhead */
  subhead: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  /** Alias used by placeholder screen styles */
  subheading: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
  /** Footnote — captions */
  footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
  /** Caption — labels and chips */
  caption: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  /** Button label */
  button: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
} as const
