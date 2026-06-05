export const mobileTheme = {
  colors: {
    background: '#08090d',
    surface: '#1a1a1a',
    foreground: '#f8f9fb',
    foregroundMuted: 'rgba(248, 249, 251, 0.6)',
    border: 'rgba(255, 255, 255, 0.1)',
    primary: '#6366f1',
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
