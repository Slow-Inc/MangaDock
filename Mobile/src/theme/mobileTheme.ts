export const mobileTheme = {
  colors: {
    background: '#0b0b0d',
    surface: '#151518',
    foreground: '#f1f1f3',
    foregroundMuted: 'rgba(248, 249, 251, 0.6)',
    border: 'rgba(255, 255, 255, 0.1)',
    primary: '#5aa2ff',
    danger: '#ff6b6b',
    secondary: '#f59e0b',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    safeScreenPadding: 16,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  typography: {
    titleSize: 18,
    bodySize: 14,
    labelSize: 12,
  },
  touchTarget: {
    minHeight: 44,
  },
} as const;
