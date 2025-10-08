// App configuration flags
export const APP_CONFIG = {
  // Set to true to show alpha badge across the app
  showAlphaBadge: true,
} as const;

// Color scheme
export const COLORS = {
  primary: '#4B0082',      // Indigo (Purple)
  secondary: '#FFD700',    // Gold
  white: '#FFFFFF',        // White
  black: '#000000',        // Black
  silver: '#C0C0C0',       // Silver
  // Additional derived colors
  primaryLight: '#6B2C91', // Lighter indigo
  primaryDark: '#3A0066',  // Darker indigo
  secondaryLight: '#FFE55C', // Lighter gold
  secondaryDark: '#E6C200',  // Darker gold
  background: '#FFFFFF',    // White background
  surface: '#F8F9FA',       // Light gray surface
  text: '#000000',          // Black text
  textSecondary: '#666666', // Gray text
  border: '#E5E5EA',        // Light border
} as const;