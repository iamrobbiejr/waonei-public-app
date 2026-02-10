import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@waonei_onboarding_complete';

export const hasCompletedOnboarding = async () => {
    try {
        const value = await AsyncStorage.getItem(ONBOARDING_KEY);
        return value === 'true';
    } catch (error) {
        console.error('Error checking onboarding status:', error);
        return false;
    }
};

export const setOnboardingComplete = async () => {
    try {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
        console.error('Error setting onboarding complete:', error);
    }
};

export const resetOnboarding = async () => {
    try {
        await AsyncStorage.removeItem(ONBOARDING_KEY);
    } catch (error) {
        console.error('Error resetting onboarding:', error);
    }
};
