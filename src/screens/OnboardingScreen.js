import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { setOnboardingComplete } from '../utils/storage';

const { width, height } = Dimensions.get('window');

const ONBOARDING_SLIDES = [
    {
        id: '1',
        icon: '🚨',
        title: 'Report Traffic Violations',
        subtitle: 'Anonymously',
        description: 'Help make roads safer by reporting traffic violations in real-time. Your identity stays protected.',
    },
    {
        id: '2',
        icon: '📸',
        title: 'Capture Evidence',
        subtitle: 'Photo or Video',
        description: 'Simply take a photo or record a short video of the violation as it happens. Quick and easy.',
    },
    {
        id: '3',
        icon: '🤖',
        title: 'AI-Powered Analysis',
        subtitle: 'Smart Verification',
        description: 'Our AI automatically verifies violations and extracts vehicle details. Just capture and submit.',
    },
];

const OnboardingSlide = ({ item }) => {
    return (
        <View style={styles.slide}>
            <View style={styles.iconContainer}>
                <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );
};

const Pagination = ({ data, currentIndex }) => {
    return (
        <View style={styles.pagination}>
            {data.map((_, index) => (
                <View
                    key={index}
                    style={[
                        styles.dot,
                        currentIndex === index && styles.dotActive,
                    ]}
                />
            ))}
        </View>
    );
};

export default function OnboardingScreen({ navigation }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const handleNext = () => {
        if (currentIndex < ONBOARDING_SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        }
    };

    const handleGetStarted = async () => {
        await setOnboardingComplete();
        navigation.replace('Reporting');
    };

    const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

    return (
        <LinearGradient
            colors={[COLORS.bgDark, '#1a1a2e', COLORS.bgDark]}
            style={styles.container}
        >
            <StatusBar style="light" />

            {/* Skip button */}
            {!isLastSlide && (
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleGetStarted}
                >
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={ONBOARDING_SLIDES}
                renderItem={({ item }) => <OnboardingSlide item={item} />}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                bounces={false}
            />

            {/* Bottom section */}
            <View style={styles.bottomSection}>
                <Pagination data={ONBOARDING_SLIDES} currentIndex={currentIndex} />

                <TouchableOpacity
                    style={styles.button}
                    onPress={isLastSlide ? handleGetStarted : handleNext}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.buttonGradient}
                    >
                        <Text style={styles.buttonText}>
                            {isLastSlide ? 'Get Started' : 'Next'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: SPACING.lg,
        zIndex: 10,
        padding: SPACING.sm,
    },
    skipText: {
        color: COLORS.textSecondary,
        fontSize: 16,
        fontWeight: '500',
    },
    slide: {
        width,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
        paddingTop: 60,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: COLORS.glass,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    icon: {
        fontSize: 64,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: 24,
        fontWeight: '600',
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    description: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: SPACING.md,
    },
    bottomSection: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: 60,
        alignItems: 'center',
    },
    pagination: {
        flexDirection: 'row',
        marginBottom: SPACING.xl,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.bgCardLight,
        marginHorizontal: 5,
    },
    dotActive: {
        backgroundColor: COLORS.primary,
        width: 30,
    },
    button: {
        width: '100%',
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonGradient: {
        paddingVertical: SPACING.md + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
});
