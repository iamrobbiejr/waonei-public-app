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

export const VEHICLE_COLORS = [
    { label: 'White', value: 'white' },
    { label: 'Silver', value: 'silver' },
    { label: 'Grey', value: 'grey' },
    { label: 'Black', value: 'black' },
    { label: 'Blue', value: 'blue' },
    { label: 'Red', value: 'red' },
    { label: 'Gold', value: 'gold' },
    { label: 'Beige', value: 'beige' },
    { label: 'Green', value: 'green' },
    { label: 'Yellow', value: 'yellow' },
    { label: 'Orange', value: 'orange' },
    { label: 'Brown', value: 'brown' },
    { label: 'Maroon', value: 'maroon' },
    { label: 'Navy Blue', value: 'navy_blue' },
    { label: 'Pearl', value: 'pearl' },
];

export const VEHICLE_MAKES = [
    'Toyota', 'Honda', 'Nissan', 'Mazda', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 
    'Ford', 'Chevrolet', 'Hyundai', 'Kia', 'Mitsubishi', 'Subaru', 'Isuzu', 'Suzuki', 
    'Lexus', 'Volvo', 'Land Rover', 'Range Rover', 'Jaguar', 'Porsche', 'Jeep', 'Dodge', 
    'Chrysler', 'Fiat', 'Peugeot', 'Renault', 'Citroen', 'Opel', 'Seat', 'Skoda', 
    'Alfa Romeo', 'Mini', 'Tesla', 'MG', 'Great Wall', 'Haval', 'Geely', 'Chery', 
    'BYD', 'JAC', 'Foton', 'Mahindra', 'Tata', 'Hino', 'Scania', 'DAF', 'MAN'
];
