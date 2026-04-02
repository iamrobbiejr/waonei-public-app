import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
    Modal,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {CameraView, useCameraPermissions, useMicrophonePermissions} from 'expo-camera';
import * as Location from 'expo-location';
import { COLORS, SPACING, BORDER_RADIUS, VIOLATION_TYPES } from '../constants/theme';
import { submitReport } from '../services/api';

const { width, height } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30; // 30 seconds max

export default function ReportingScreen() {
    // Camera states
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
    const [showCamera, setShowCamera] = useState(false);
    const [cameraMode, setCameraMode] = useState('picture'); // 'picture' or 'video'
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const cameraRef = useRef(null);
    const recordingTimerRef = useRef(null);

    // Media state
    const [capturedMedia, setCapturedMedia] = useState(null);

    // Form states
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [violationType, setViolationType] = useState('');
    const [showViolationPicker, setShowViolationPicker] = useState(false);
    const [description, setDescription] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [vehicleMake, setVehicleMake] = useState('');

    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Get location on mount
    useEffect(() => {
        getLocation();
    }, []);

    // Cleanup recording timer
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        };
    }, []);

    const getLocation = async () => {
        try {
            setLocationLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is needed to tag your report.');
                setLocationLoading(false);
                return;
            }

            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            // Try to get address
            let address = '';
            try {
                const [addressResult] = await Location.reverseGeocodeAsync({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                });
                if (addressResult) {
                    address = [
                        addressResult.street,
                        addressResult.city,
                        addressResult.region,
                    ].filter(Boolean).join(', ');
                }
            } catch (e) {
                console.log('Could not get address:', e);
            }

            setLocation({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                address: address || 'Location captured',
            });
        } catch (error) {
            console.error('Error getting location:', error);
            Alert.alert('Error', 'Could not get your location. Please try again.');
        } finally {
            setLocationLoading(false);
        }
    };

    const openCamera = async (mode) => {
        if (!cameraPermission?.granted) {
            const result = await requestCameraPermission();
            if (!result.granted) {
                Alert.alert('Permission Denied', 'Camera permission is needed to capture evidence.');
                return;
            }
        }
        setCameraMode(mode);
        setShowCamera(true);
    };

    const takePicture = async () => {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                });
                setCapturedMedia({
                    uri: photo.uri,
                    type: 'image/jpeg',
                    isVideo: false,
                });
                setShowCamera(false);
            } catch (error) {
                console.error('Error taking picture:', error);
                Alert.alert('Error', 'Failed to capture photo. Please try again.');
            }
        }
    };

    const startRecording = async () => {
        if (cameraRef.current) {
            try {
                setIsRecording(true);
                setRecordingTime(0);

                // Start timer
                recordingTimerRef.current = setInterval(() => {
                    setRecordingTime(prev => {
                        if (prev >= MAX_VIDEO_DURATION - 1) {
                            stopRecording();
                            return MAX_VIDEO_DURATION;
                        }
                        return prev + 1;
                    });
                }, 1000);

                const video = await cameraRef.current.recordAsync({
                    maxDuration: MAX_VIDEO_DURATION,
                });

                setCapturedMedia({
                    uri: video.uri,
                    type: 'video/mp4',
                    isVideo: true,
                });
                setShowCamera(false);
            } catch (error) {
                console.error('Error recording video:', error);
                Alert.alert('Error', 'Failed to record video. Please try again.');
            } finally {
                setIsRecording(false);
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                }
            }
        }
    };

    const stopRecording = async () => {
        if (cameraRef.current && isRecording) {
            cameraRef.current.stopRecording();
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
    };

    const removeMedia = () => {
        setCapturedMedia(null);
    };

    const resetForm = () => {
        setCapturedMedia(null);
        setViolationType('');
        setDescription('');
        setVehiclePlate('');
        setVehicleColor('');
        setVehicleMake('');
        getLocation(); // Refresh location
    };

    const handleSubmit = async () => {
        // Validation
        if (!capturedMedia) {
            Alert.alert('Missing Evidence', 'Please capture a photo or video of the violation.');
            return;
        }

        if (!violationType) {
            Alert.alert('Missing Information', 'Please select the type of violation.');
            return;
        }

        setIsSubmitting(true);

        try {
            await submitReport({
                file: capturedMedia,
                latitude: location?.latitude,
                longitude: location?.longitude,
                locationDescription: location?.address,
                violationType,
                description,
                vehiclePlate,
                vehicleColor,
                vehicleMake,
            });

            setSubmitSuccess(true);

            // Reset form after 3 seconds
            setTimeout(() => {
                setSubmitSuccess(false);
                setCapturedMedia(null);
                setViolationType('');
                setDescription('');
                setVehiclePlate('');
                setVehicleColor('');
                setVehicleMake('');
                getLocation(); // Refresh location
            }, 3000);
        } catch (error) {
            Alert.alert(
                'Submission Failed',
                error.message || 'Could not submit report. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedViolation = VIOLATION_TYPES.find(v => v.value === violationType);

    // Success screen
    if (submitSuccess) {
        return (
            <LinearGradient colors={[COLORS.bgDark, '#1a1a2e', COLORS.bgDark]} style={styles.container}>
                <StatusBar style="light" />
                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <Text style={styles.successEmoji}>✅</Text>
                    </View>
                    <Text style={styles.successTitle}>Report Submitted!</Text>
                    <Text style={styles.successText}>
                        Your report is being analyzed by our AI. Thank you for helping make roads safer.
                    </Text>
                </View>
            </LinearGradient>
        );
    }

    // Camera view
    if (showCamera) {
        return (
            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    mode={cameraMode}
                />
                {/* Overlay positioned absolutely on top of camera */}
                <View style={styles.cameraOverlay}>
                    <TouchableOpacity
                        style={styles.cameraCloseButton}
                        onPress={() => {
                            if (isRecording) stopRecording();
                            setShowCamera(false);
                        }}
                    >
                        <Text style={styles.cameraCloseText}>✕</Text>
                    </TouchableOpacity>

                    {cameraMode === 'video' && isRecording && (
                        <View style={styles.recordingIndicator}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingTime}>
                                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                                {(recordingTime % 60).toString().padStart(2, '0')}
                            </Text>
                            <Text style={styles.recordingMax}> / 00:30</Text>
                        </View>
                    )}

                    <View style={styles.cameraControls}>
                        <View style={styles.cameraModeSwitch}>
                            <TouchableOpacity
                                style={[styles.modeButton, cameraMode === 'picture' && styles.modeButtonActive]}
                                onPress={() => !isRecording && setCameraMode('picture')}
                            >
                                <Text style={styles.modeButtonText}>📷 Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modeButton, cameraMode === 'video' && styles.modeButtonActive]}
                                onPress={() => !isRecording && setCameraMode('video')}
                            >
                                <Text style={styles.modeButtonText}>🎥 Video</Text>
                            </TouchableOpacity>
                        </View>

                        {cameraMode === 'picture' ? (
                            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                                <View style={styles.captureButtonInner} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.captureButton, isRecording && styles.captureButtonRecording]}
                                onPress={isRecording ? stopRecording : startRecording}
                            >
                                <View style={[
                                    styles.captureButtonInner,
                                    isRecording && styles.captureButtonInnerRecording
                                ]} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <LinearGradient colors={[COLORS.bgDark, '#1a1a2e', COLORS.bgDark]} style={styles.container}>
            <StatusBar style="light" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Report Violation</Text>
                    <Text style={styles.headerSubtitle}>
                        Capture evidence of traffic violations
                    </Text>
                </View>

                {/* Media Capture Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📸 Evidence</Text>

                    {capturedMedia ? (
                        <View style={styles.mediaPreviewContainer}>
                            <Image
                                source={{ uri: capturedMedia.uri }}
                                style={styles.mediaPreview}
                                resizeMode="cover"
                            />
                            {capturedMedia.isVideo && (
                                <View style={styles.videoIndicator}>
                                    <Text style={styles.videoIndicatorText}>🎥 Video</Text>
                                </View>
                            )}
                            <TouchableOpacity style={styles.removeMediaButton} onPress={removeMedia}>
                                <Text style={styles.removeMediaText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.captureButtons}>
                            <TouchableOpacity
                                style={styles.captureOptionButton}
                                onPress={() => openCamera('picture')}
                            >
                                <Text style={styles.captureOptionIcon}>📷</Text>
                                <Text style={styles.captureOptionText}>Take Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.captureOptionButton}
                                onPress={() => openCamera('video')}
                            >
                                <Text style={styles.captureOptionIcon}>🎥</Text>
                                <Text style={styles.captureOptionText}>Record Video</Text>
                                <Text style={styles.captureOptionHint}>30s max</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Location Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📍 Location</Text>
                    <View style={styles.locationCard}>
                        {locationLoading ? (
                            <ActivityIndicator color={COLORS.primary} />
                        ) : location ? (
                            <>
                                <Text style={styles.locationAddress}>{location.address}</Text>
                                <Text style={styles.locationCoords}>
                                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                </Text>
                            </>
                        ) : (
                            <TouchableOpacity onPress={getLocation}>
                                <Text style={styles.locationRetry}>Tap to retry location</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Violation Type Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚠️ Violation Type *</Text>
                    <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowViolationPicker(true)}
                    >
                        <Text style={[
                            styles.pickerButtonText,
                            !selectedViolation && styles.pickerPlaceholder
                        ]}>
                            {selectedViolation ? selectedViolation.label : 'Select violation type'}
                        </Text>
                        <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                </View>

                {/* Description Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📝 Additional Details</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Describe what happened..."
                        placeholderTextColor={COLORS.textMuted}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Vehicle Details Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🚗 Vehicle Details (Optional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="License Plate Number"
                        placeholderTextColor={COLORS.textMuted}
                        value={vehiclePlate}
                        onChangeText={setVehiclePlate}
                        autoCapitalize="characters"
                    />
                    <View style={styles.inputRow}>
                        <TextInput
                            style={[styles.input, styles.inputHalf]}
                            placeholder="Color"
                            placeholderTextColor={COLORS.textMuted}
                            value={vehicleColor}
                            onChangeText={setVehicleColor}
                        />
                        <TextInput
                            style={[styles.input, styles.inputHalf]}
                            placeholder="Make/Model"
                            placeholderTextColor={COLORS.textMuted}
                            value={vehicleMake}
                            onChangeText={setVehicleMake}
                        />
                    </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={isSubmitting
                            ? [COLORS.bgCardLight, COLORS.bgCardLight]
                            : [COLORS.primary, COLORS.primaryDark]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.submitButtonGradient}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.submitButtonText}>Submit Report</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Reset Button */}
                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={resetForm}
                    activeOpacity={0.8}
                >
                    <Text style={styles.resetButtonText}>🔄 Reset Form</Text>
                </TouchableOpacity>

                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Violation Type Picker Modal */}
            <Modal
                visible={showViolationPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowViolationPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowViolationPicker(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Violation Type</Text>
                        {VIOLATION_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.modalOption,
                                    violationType === type.value && styles.modalOptionSelected
                                ]}
                                onPress={() => {
                                    setViolationType(type.value);
                                    setShowViolationPicker(false);
                                }}
                            >
                                <Text style={[
                                    styles.modalOptionText,
                                    violationType === type.value && styles.modalOptionTextSelected
                                ]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: SPACING.lg,
        paddingTop: 60,
    },
    header: {
        marginBottom: SPACING.xl,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    headerSubtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    section: {
        marginBottom: SPACING.lg,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    captureButtons: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    captureOptionButton: {
        flex: 1,
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.bgCardLight,
        borderStyle: 'dashed',
    },
    captureOptionIcon: {
        fontSize: 32,
        marginBottom: SPACING.sm,
    },
    captureOptionText: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '500',
    },
    captureOptionHint: {
        color: COLORS.textMuted,
        fontSize: 12,
        marginTop: SPACING.xs,
    },
    mediaPreviewContainer: {
        position: 'relative',
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
    },
    mediaPreview: {
        width: '100%',
        height: 200,
        backgroundColor: COLORS.bgCard,
    },
    videoIndicator: {
        position: 'absolute',
        top: SPACING.sm,
        left: SPACING.sm,
        backgroundColor: COLORS.overlay,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
    },
    videoIndicatorText: {
        color: COLORS.white,
        fontSize: 12,
    },
    removeMediaButton: {
        position: 'absolute',
        top: SPACING.sm,
        right: SPACING.sm,
        backgroundColor: COLORS.error,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeMediaText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: 'bold',
    },
    locationCard: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        minHeight: 60,
        justifyContent: 'center',
    },
    locationAddress: {
        color: COLORS.textPrimary,
        fontSize: 14,
        marginBottom: SPACING.xs,
    },
    locationCoords: {
        color: COLORS.textMuted,
        fontSize: 12,
    },
    locationRetry: {
        color: COLORS.primary,
        fontSize: 14,
    },
    pickerButton: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pickerButtonText: {
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    pickerPlaceholder: {
        color: COLORS.textMuted,
    },
    pickerArrow: {
        color: COLORS.textMuted,
        fontSize: 12,
    },
    textInput: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        color: COLORS.textPrimary,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    input: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        color: COLORS.textPrimary,
        fontSize: 16,
        marginBottom: SPACING.sm,
    },
    inputRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    inputHalf: {
        flex: 1,
        marginBottom: 0,
    },
    submitButton: {
        marginTop: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonGradient: {
        paddingVertical: SPACING.md + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonText: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    bottomPadding: {
        height: 40,
    },
    resetButton: {
        marginTop: SPACING.md,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    resetButtonText: {
        color: COLORS.textMuted,
        fontSize: 16,
        fontWeight: '500',
    },

    // Camera styles
    cameraContainer: {
        flex: 1,
        backgroundColor: COLORS.black,
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        justifyContent: 'flex-end',
    },
    cameraCloseButton: {
        position: 'absolute',
        top: 60,
        left: SPACING.lg,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    cameraCloseText: {
        color: COLORS.white,
        fontSize: 20,
        fontWeight: 'bold',
    },
    recordingIndicator: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.overlay,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.error,
        marginRight: SPACING.sm,
    },
    recordingTime: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
    },
    recordingMax: {
        color: COLORS.textMuted,
        fontSize: 16,
    },
    cameraControls: {
        paddingBottom: 60,
        alignItems: 'center',
    },
    cameraModeSwitch: {
        flexDirection: 'row',
        backgroundColor: COLORS.overlay,
        borderRadius: BORDER_RADIUS.full,
        padding: 4,
        marginBottom: SPACING.lg,
    },
    modeButton: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
    },
    modeButtonActive: {
        backgroundColor: COLORS.primary,
    },
    modeButtonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '500',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'transparent',
        borderWidth: 4,
        borderColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureButtonRecording: {
        borderColor: COLORS.error,
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.white,
    },
    captureButtonInnerRecording: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: COLORS.error,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    modalContent: {
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        width: '100%',
        maxWidth: 340,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
        textAlign: 'center',
    },
    modalOption: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
    },
    modalOptionSelected: {
        backgroundColor: COLORS.primary + '20',
    },
    modalOptionText: {
        color: COLORS.textPrimary,
        fontSize: 16,
    },
    modalOptionTextSelected: {
        color: COLORS.primary,
        fontWeight: '600',
    },

    // Success screen
    successContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    successIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.glass,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    successEmoji: {
        fontSize: 56,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    successText: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
});
