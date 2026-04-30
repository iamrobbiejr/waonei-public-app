// Theme constants for Waonei app
export const COLORS = {
    // Primary palette
    primary: '#6366F1',       // Indigo
    primaryDark: '#4F46E5',
    primaryLight: '#818CF8',

    // Accent
    accent: '#F59E0B',        // Amber
    accentDark: '#D97706',

    // Background
    bgDark: '#0F172A',        // Slate 900
    bgCard: '#1E293B',        // Slate 800
    bgCardLight: '#334155',   // Slate 700

    // Text
    textPrimary: '#F8FAFC',   // Slate 50
    textSecondary: '#94A3B8', // Slate 400
    textMuted: '#64748B',     // Slate 500

    // Status
    success: '#10B981',       // Emerald
    error: '#EF4444',         // Red
    warning: '#F59E0B',       // Amber

    // Misc
    white: '#FFFFFF',
    black: '#000000',
    overlay: 'rgba(0, 0, 0, 0.5)',
    glass: 'rgba(255, 255, 255, 0.1)',
};

export const FONTS = {
    regular: 'System',
    medium: 'System',
    bold: 'System',
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const BORDER_RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
};

export const VIOLATION_TYPES = [
    { value: 'no_helmet', label: '🏍️ No Helmet' },
    { value: 'red_light', label: '🚦 Red Light Violation' },
    { value: 'wrong_way', label: '↩️ Wrong Way Driving' },
    { value: 'illegal_parking', label: '🅿️ Illegal Parking' },
    { value: 'phone_usage', label: '📱 Phone Usage While Driving' },
    { value: 'seatbelt_violation', label: '🔒 Seatbelt Violation' },
];
