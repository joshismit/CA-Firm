// src/lib/tokens.ts
// TypeScript mirror of CSS design tokens
// Keep in sync with src/styles/variables.css

export const tokens = {
  colors: {
    primary: {
      50:  '#EEF2FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      600: '#4F46E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
      950: '#1E1B4B',
    },
    success:  '#10B981',
    warning:  '#F59E0B',
    danger:   '#F43F5E',
    info:     '#0EA5E9',
  },
  radius: {
    xs:   '2px',
    sm:   '4px',
    md:   '6px',
    lg:   '8px',
    xl:   '12px',
    '2xl':'16px',
    full: '9999px',
  },
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  fontSize: {
    display: '2.25rem',
    h1: '1.75rem',
    h2: '1.375rem',
    h3: '1.125rem',
    h4: '0.9375rem',
    bodyLg: '0.9375rem',
    body: '0.8125rem',
    sm: '0.75rem',
    xs: '0.6875rem',
    '2xs': '0.625rem',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  headingTracking: '-0.015em',
  headingLine: 1.25,
  bodyLine: 1.5,
  layout: {
    sidebarWidth: '240px',
    sidebarCollapsed: '56px',
    headerHeight: '56px',
    contentMaxWidth: '1280px',
  },
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBg: 1040,
    modal: 1050,
    popover: 1060,
    toast: 1070,
    tooltip: 1080,
  },
} as const

export type PrimaryShade = keyof typeof tokens.colors.primary
export type SpacingKey = keyof typeof tokens.spacing
