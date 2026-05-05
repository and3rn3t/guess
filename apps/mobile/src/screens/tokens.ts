/**
 * Design tokens for mobile game screens.
 *
 * Centralising colours, radii, and spacing here lets all screen
 * components stay in sync and makes a future theme migration trivial.
 */

export const colors = {
  /** Primary action background — blue-500 */
  primaryBg: '#3b82f6',
  /** Primary action foreground — slate-50 */
  primaryFg: '#f8fafc',
  /** Secondary action foreground — blue-300 */
  secondaryFg: '#93c5fd',
  /** Secondary action border — blue-500 */
  secondaryBorder: '#3b82f6',
  /** Destructive / warning action background */
  destructiveBg: '#ef4444',
} as const

export const radii = {
  button: 14,
} as const

export const spacing = {
  buttonV: 12,
  buttonH: 16,
  rowGap: 10,
  rowTop: 8,
} as const

export const typography = {
  buttonSize: 14,
  buttonWeight: '700' as const,
} as const
