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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {CameraView, useCameraPermissions, useMicrophonePermissions} from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS, VIOLATION_TYPES, VEHICLE_COLORS, VEHICLE_MAKES } from '../constants/theme';
import { PROFANITY_LIST } from '../constants/validation';
import { submitReport } from '../services/api';

const MAX_VIDEO_DURATION = 15; // 15 seconds max — keeps files small for fast upload



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
    const [description, setDescription] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [vehicleColor, setVehicleColor] = useState('');
    const [vehicleMake, setVehicleMake] = useState('');

    // Picker and Suggestions states
    const [showViolationPicker, setShowViolationPicker] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [filteredMakes, setFilteredMakes] = useState([]);
    const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);

    // Validation state
    const [errors, setErrors] = useState({});

    // Submission / upload progress state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [uploadPhase, setUploadPhase] = useState('idle'); // 'idle' | 'compressing' | 'uploading'
    const [uploadProgress, setUploadProgress] = useState(0);

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
        // Check Camera Permission
        if (!cameraPermission?.granted) {
            const result = await requestCameraPermission();
            if (!result.granted) {
                Alert.alert('Permission Denied', 'Camera permission is needed to capture evidence.');
                return;
            }
        }

        // Check Microphone Permission (Required for video)
        if (mode === 'video' && !microphonePermission?.granted) {
            const result = await requestMicrophonePermission();
            if (!result.granted) {
                Alert.alert('Permission Denied', 'Microphone permission is needed to record video.');
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
                    quality: '480p', // lower bitrate — dramatically reduces file size
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

    const pickMedia = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                quality: 0.8,
                allowsEditing: true,
            });

            if (!result.canceled) {
                const asset = result.assets[0];
                const isVideo = asset.type === 'video';

                // Hard-reject gallery videos that are far too large to compress in time
                if (isVideo && asset.fileSize && asset.fileSize > 60 * 1024 * 1024) {
                    Alert.alert(
                        'Video Too Large',
                        'This video is too large (over 60 MB). Please select a shorter clip — ideally under 15 seconds.',
                    );
                    return;
                }

                setCapturedMedia({
                    uri: asset.uri,
                    type: isVideo ? 'video/mp4' : 'image/jpeg',
                    isVideo,
                    fileSize: asset.fileSize,
                });
            }
        } catch (error) {
            console.error('Error picking media:', error);
            Alert.alert('Error', 'Failed to pick media from gallery.');
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
        setErrors({});
        setFilteredMakes([]);
        setShowMakeSuggestions(false);
        getLocation(); // Refresh location
    };

    const handleMakeChange = (text) => {
        setVehicleMake(text);
        if (text.length > 0) {
            const filtered = VEHICLE_MAKES.filter(make => 
                make.toLowerCase().includes(text.toLowerCase())
            ).slice(0, 5); // Limit to 5 suggestions for cleaner UI
            setFilteredMakes(filtered);
            setShowMakeSuggestions(filtered.length > 0);
        } else {
            setFilteredMakes([]);
            setShowMakeSuggestions(false);
        }
        
        // Clear error when user types
        if (errors.vehicleMake) {
            setErrors(prev => ({ ...prev, vehicleMake: null }));
        }
    };

    const selectMake = (make) => {
        setVehicleMake(make);
        setFilteredMakes([]);
        setShowMakeSuggestions(false);
    };

    const getWordCount = (text) => {
        return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    };

    const hasGibberish = (text) => {
        // Check for 5+ repeating characters (e.g., aaaaa)
        const charRepeat = /(.)\1{4,}/;
        if (charRepeat.test(text.replace(/\s/g, ''))) return true;

        // Check for 3+ repeating words (e.g., test test test)
        const words = text.toLowerCase().trim().split(/\s+/);
        for (let i = 0; i < words.length - 2; i++) {
            if (words[i] === words[i+1] && words[i] === words[i+2]) return true;
        }

        return false;
    };

    const containsProfanity = (text) => {
        const lowerText = text.toLowerCase();
        return PROFANITY_LIST.some(word => lowerText.includes(word));
    };

    const handleSubmit = async () => {
        const newErrors = {};

        // 1. Core Validation
        if (!capturedMedia) {
            Alert.alert('Missing Evidence', 'Please capture a photo or video of the violation.');
            return;
        }

        if (!violationType) {
            newErrors.violationType = 'Please select the type of violation.';
        }

        // 2. Description Validation (Optional but must meet limits if provided)
        if (description.trim().length > 0) {
            const wordCount = getWordCount(description);
            if (wordCount < 5) {
                newErrors.description = 'Description is too short (minimum 5 words).';
            } else if (wordCount > 100) {
                newErrors.description = 'Description is too long (maximum 100 words).';
            }

            // Language/Character set validation
            // Allowing Latin characters, numbers, and standard punctuation common in English/Shona/Ndebele
            const langRegex = /^[a-zA-Z0-9\s.,!?'"()\-]+$/;
            if (!langRegex.test(description)) {
                newErrors.description = 'Please use English, Shona, or Ndebele (standard characters only).';
            }

            // Gibberish / Profanity validation
            if (hasGibberish(description)) {
                newErrors.description = 'Please provide a clear description without repeating characters or words.';
            } else if (containsProfanity(description)) {
                newErrors.description = 'Your description contains prohibited language. Please keep it professional.';
            }
        }

        // 3. Vehicle Details Validation (Optional but must be valid if provided)
        if (vehiclePlate.trim().length > 0) {
            const plateRegex = /^[A-Z]{3}\d{4}$/;
            if (!plateRegex.test(vehiclePlate.replace(/\s/g, ''))) {
                newErrors.vehiclePlate = 'Invalid Zimbabwe plate format (e.g. AHQ1234).';
            }
        }

        // If errors exist, stop and show them
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Alert for the first error or general message
            const firstError = Object.values(newErrors)[0];
            Alert.alert('Form Error', firstError);
            return;
        }

        setErrors({});
        setIsSubmitting(true);
        setUploadPhase('idle');
        setUploadProgress(0);

        try {
            await submitReport(
                {
                    file: capturedMedia,
                    latitude: location?.latitude,
                    longitude: location?.longitude,
                    locationDescription: location?.address,
                    violationType,
                    description,
                    vehiclePlate: vehiclePlate.replace(/\s/g, '').toUpperCase(),
                    vehicleColor,
                    vehicleMake,
                },
                ({ phase, percent }) => {
                    setUploadPhase(phase);
                    setUploadProgress(percent);
                }
            );

            setSubmitSuccess(true);

            // Reset form after 3 seconds
            setTimeout(() => {
                setSubmitSuccess(false);
                resetForm();
            }, 3000);
        } catch (error) {
            Alert.alert(
                'Submission Failed',
                error.message || 'Could not submit report. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
            setUploadPhase('idle');
            setUploadProgress(0);
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
                    
                    {/* Testing Section */}
                    {!capturedMedia && (
                        <View style={styles.testingContainer}>
                            <TouchableOpacity
                                style={styles.testingButton}
                                onPress={pickMedia}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.testingButtonIcon}>📂</Text>
                                <Text style={styles.testingButtonText}>Upload for Testing</Text>
                            </TouchableOpacity>
                            <View style={styles.disclaimerContainer}>
                                <Text style={styles.disclaimerText}>
                                    ⚠️ TESTING ONLY: Select images or clips from your device for testing purposes.
                                </Text>
                            </View>
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
                        style={[styles.pickerButton, errors.violationType && styles.inputError]}
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
                    {errors.violationType && <Text style={styles.errorText}>{errors.violationType}</Text>}
                </View>

                {/* Description Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📝 Additional Details</Text>
                    <TextInput
                        style={[styles.textInput, errors.description && styles.inputError]}
                        placeholder="Describe what happened..."
                        placeholderTextColor={COLORS.textMuted}
                        value={description}
                        onChangeText={(text) => {
                            setDescription(text);
                            if (errors.description) setErrors(prev => ({ ...prev, description: null }));
                        }}
                        multiline
                        numberOfLines={3}
                    />
                    <View style={styles.helperRow}>
                        <Text style={styles.helperText}>Min 5 words, max 100 words. (Eng/Sho/Nde)</Text>
                        <Text style={[
                            styles.wordCount, 
                            (getWordCount(description) < 5 || getWordCount(description) > 100) && description.length > 0 && { color: COLORS.error }
                        ]}>
                            {getWordCount(description)} words
                        </Text>
                    </View>
                    {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
                </View>

                {/* Vehicle Details Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🚗 Vehicle Details (Optional)</Text>
                    <TextInput
                        style={[styles.input, errors.vehiclePlate && styles.inputError]}
                        placeholder="License Plate Number (e.g. AHQ1234)"
                        placeholderTextColor={COLORS.textMuted}
                        value={vehiclePlate}
                        onChangeText={(text) => {
                            setVehiclePlate(text);
                            if (errors.vehiclePlate) setErrors(prev => ({ ...prev, vehiclePlate: null }));
                        }}
                        autoCapitalize="characters"
                    />
                    {errors.vehiclePlate && <Text style={styles.errorText}>{errors.vehiclePlate}</Text>}
                    
                    <View style={styles.inputRow}>
                        <View style={styles.inputHalf}>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => setShowColorPicker(true)}
                            >
                                <Text style={[
                                    styles.pickerButtonText,
                                    !vehicleColor && styles.pickerPlaceholder
                                ]}>
                                    {vehicleColor ? VEHICLE_COLORS.find(c => c.value === vehicleColor)?.label : 'Color'}
                                </Text>
                                <Text style={styles.pickerArrow}>▼</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.inputHalf}>
                            <TextInput
                                style={styles.input}
                                placeholder="Make (e.g. Toyota)"
                                placeholderTextColor={COLORS.textMuted}
                                value={vehicleMake}
                                onChangeText={handleMakeChange}
                                onFocus={() => vehicleMake.length > 0 && setShowMakeSuggestions(true)}
                            />
                        </View>
                    </View>

                    {/* Make Suggestions */}
                    {showMakeSuggestions && filteredMakes.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            {filteredMakes.map((make, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.suggestionItem}
                                    onPress={() => selectMake(make)}
                                >
                                    <Text style={styles.suggestionText}>{make}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
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
                            <View style={styles.progressContainer}>
                                <Text style={styles.progressLabel}>
                                    {uploadPhase === 'compressing'
                                        ? `🗜️ Compressing… ${Math.min(100, uploadProgress)}%`
                                        : uploadPhase === 'uploading'
                                        ? `📤 Uploading… ${Math.min(100, uploadProgress)}%`
                                        : 'Preparing…'}
                                </Text>
                                <View style={styles.progressBarTrack}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${Math.min(100, Math.max(0, uploadProgress))}%` },
                                        ]}
                                    />
                                </View>
                            </View>
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

            {/* Vehicle Color Picker Modal */}
            <Modal
                visible={showColorPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowColorPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowColorPicker(false)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Vehicle Color</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {VEHICLE_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color.value}
                                    style={[
                                        styles.modalOption,
                                        vehicleColor === color.value && styles.modalOptionSelected
                                    ]}
                                    onPress={() => {
                                        setVehicleColor(color.value);
                                        setShowColorPicker(false);
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={[
                                            styles.colorDot, 
                                            { backgroundColor: color.value === 'pearl' ? '#f0f0f0' : color.value.replace('_', '') }
                                        ]} />
                                        <Text style={[
                                            styles.modalOptionText,
                                            vehicleColor === color.value && styles.modalOptionTextSelected
                                        ]}>
                                            {color.label}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
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
    progressContainer: {
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: SPACING.md,
    },
    progressLabel: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: SPACING.xs,
    },
    progressBarTrack: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.white,
        borderRadius: 3,
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
    errorText: {
        color: COLORS.error,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    inputError: {
        borderColor: COLORS.error,
        borderWidth: 1,
    },
    helperRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: SPACING.xs,
        paddingHorizontal: 4,
    },
    helperText: {
        color: COLORS.textMuted,
        fontSize: 12,
    },
    wordCount: {
        color: COLORS.textMuted,
        fontSize: 12,
    },
    suggestionsContainer: {
        backgroundColor: COLORS.bgCardLight,
        borderRadius: BORDER_RADIUS.md,
        marginTop: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.bgCardLight,
    },
    suggestionItem: {
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.bgCard,
    },
    suggestionText: {
        color: COLORS.textPrimary,
        fontSize: 14,
    },
    colorDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.bgCardLight,
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
    testingContainer: {
        marginTop: SPACING.md,
    },
    testingButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.bgCard,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary + '40',
        width: '100%',
    },
    testingButtonIcon: {
        fontSize: 20,
        marginRight: SPACING.sm,
    },
    testingButtonText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    disclaimerContainer: {
        marginTop: SPACING.sm,
        paddingHorizontal: SPACING.sm,
    },
    disclaimerText: {
        color: COLORS.textMuted,
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 18,
    },
});
