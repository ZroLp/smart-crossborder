export const COLORS = {
  primary: '#1677FF',
  primaryLight: '#4096FF',
  primaryDark: '#0958D9',
  success: '#00B42A',
  successLight: '#36CFC9',
  warning: '#FF7D00',
  danger: '#F53F3F',
  purple: '#722ED1',
  purpleLight: '#9254DE',
  gray: {
    50: '#F5F7FA',
    100: '#E5E6EB',
    200: '#C9CDD4',
    300: '#A6A6A6',
    400: '#86909C',
    500: '#4E5969',
    600: '#1D2129',
  },
} as const;

export const STATUS_COLORS = {
  running: '#1677FF',
  completed: '#00B42A',
  failed: '#F53F3F',
  pending: '#86909C',
  paused: '#FF7D00',
} as const;
