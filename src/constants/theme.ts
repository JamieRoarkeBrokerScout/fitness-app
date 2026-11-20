/**
 * Palette is drawn from the gym floor: rubber-floor slate, chalk-white type, and the
 * Olympic bumper-plate colours, which are reserved for data (recovery zones, strain, sleep).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1E26',
    background: '#F2EFEA',
    backgroundElement: '#E6E2DB',
    backgroundSelected: '#D9D4CB',
    textSecondary: '#5E6470',
    border: '#D2CDC4',
    action: '#1A1E26',
    actionText: '#F2EFEA',
    danger: '#B8372F',
  },
  dark: {
    text: '#EDE9E2',
    background: '#1A1E26',
    backgroundElement: '#242A35',
    backgroundSelected: '#2F3643',
    textSecondary: '#9AA1AD',
    border: '#343B48',
    action: '#EDE9E2',
    actionText: '#1A1E26',
    danger: '#E0605A',
  },
} as const;

/** Bumper-plate colours. Same in both schemes so data reads consistently. */
export const Plate = {
  green: '#3FA65A',
  yellow: '#E2B23A',
  red: '#D5483F',
  blue: '#3A78D8',
  violet: '#8C7FD6',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** Condensed display faces, loaded in the root layout. */
export const Display = {
  medium: 'BarlowCondensed_500Medium',
  semibold: 'BarlowCondensed_600SemiBold',
  bold: 'BarlowCondensed_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Spacing roles, so screens share one rhythm: tight inside a group, generous between groups. */
export const Layout = {
  /** Space between the screen edge and content. */
  gutter: 20,
  /** Inside a panel. */
  panel: 20,
  /** Between items in the same section. */
  block: Spacing.three,
  /** Above a new section. */
  section: Spacing.five,
  /** Smallest comfortable tap target. */
  touch: 44,
  /** How far a 22pt icon sits inside its 44pt IconButton, for lining it up with the gutter. */
  iconInset: 11,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 22,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
