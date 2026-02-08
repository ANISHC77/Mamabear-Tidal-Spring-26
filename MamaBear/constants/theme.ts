/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Custom color palette: e63946 (red), f1faee (cream), a8dadc (light blue), 457b9d (medium blue), 1d3557 (dark blue)
const primaryColor = '#457b9d'; // Medium blue - primary actions
const secondaryColor = '#a8dadc'; // Light blue - secondary elements
const accentColor = '#e63946'; // Red - alerts and accents
const lightBg = '#f1faee'; // Light cream - light backgrounds
const darkBg = '#1d3557'; // Dark blue - dark backgrounds

export const Colors = {
  light: {
    text: darkBg, // Dark blue text on light background
    background: lightBg, // Light cream background
    tint: primaryColor, // Medium blue for primary elements
    icon: darkBg, // Dark blue icons
    tabIconDefault: '#9BA1A6', // Muted for unselected tabs
    tabIconSelected: primaryColor, // Medium blue for selected tabs
    card: '#ffffff', // White cards on light background
    border: secondaryColor, // Light blue borders
    accent: accentColor, // Red for alerts/highlights
  },
  dark: {
    text: lightBg, // Light cream text on dark background
    background: darkBg, // Dark blue background
    tint: secondaryColor, // Light blue for primary elements in dark mode
    icon: lightBg, // Light cream icons
    tabIconDefault: '#687076', // Muted for unselected tabs
    tabIconSelected: secondaryColor, // Light blue for selected tabs
    card: '#2a2d2f', // Dark cards on dark background
    border: primaryColor, // Medium blue borders
    accent: accentColor, // Red for alerts/highlights
  },
};

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
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
