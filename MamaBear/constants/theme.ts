/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#007AFF'; // iOS Blue
const tintColorDark = '#0A84FF'; // iOS Blue Dark Mode

export const Colors = {
  light: {
    text: '#000000',
    background: '#F2F2F7', // iOS Light Background
    tint: tintColorLight,
    icon: '#8E8E93',
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorLight,
    accent: '#FF3B30', // iOS Red for alerts
    card: '#FFFFFF',
    cardSecondary: '#F9F9FB',
    heartRate: '#FF2D55', // Soft Pink for heart
    respiratory: '#5AC8FA', // Sky Blue for breathing
    success: '#34C759', // iOS Green
    warning: '#FF9500', // iOS Orange
    glass: 'rgba(255, 255, 255, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.3)',
    shadow: 'rgba(0, 0, 0, 0.1)',
    separator: 'rgba(60, 60, 67, 0.12)',
    border: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000', // iOS Dark Background
    tint: tintColorDark,
    icon: '#98989D',
    tabIconDefault: '#98989D',
    tabIconSelected: tintColorDark,
    accent: '#FF453A', // iOS Red Dark Mode
    card: '#1C1C1E',
    cardSecondary: '#2C2C2E',
    heartRate: '#FF375F',
    respiratory: '#64D2FF',
    success: '#32D74B',
    warning: '#FF9F0A',
    glass: 'rgba(28, 28, 30, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.3)',
    separator: 'rgba(84, 84, 88, 0.65)',
    border: 'rgba(255, 255, 255, 0.15)',
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
