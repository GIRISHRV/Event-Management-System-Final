/**
 * Design System Constants
 * Single source of truth for spacing, sizing, and layout values
 */

export const SPACING = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
} as const;

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const Z_INDEX = {
  base: 0,
  dropdown: 1000,
  fixed: 1030,
  backdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

export const BORDER_RADIUS = {
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  full: '9999px',
} as const;

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
} as const;

export const TRANSITIONS = {
  fast: '150ms ease-in-out',
  base: '200ms ease-in-out',
  slow: '300ms ease-in-out',
} as const;

export const LAYOUT = {
  navHeight: 65,           // px
  sidebarWidth: 280,       // px
  sidebarCollapsedWidth: 80, // px
  modalMaxWidth: 600,      // px
  drawerWidth: 420,        // px
  contentMaxWidth: 1400,   // px
} as const;

export const COLORS = {
  // Semantic
  primary: '#2563eb',      // blue-600
  success: '#16a34a',      // green-600
  warning: '#ea580c',      // orange-600
  danger: '#dc2626',       // red-600
  info: '#0891b2',         // cyan-600
  
  // Neutral
  background: '#1a1a1a',
  surface: '#2b2b2b',
  border: '#404040',
  text: '#ffffff',
  textSecondary: '#a1a1a1',
  textTertiary: '#737373',
} as const;
