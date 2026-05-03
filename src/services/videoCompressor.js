// Use the legacy import to suppress the SDK-54 deprecation warning for getInfoAsync
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

/** Hard cap for uploads *after* compression (or raw if compression unavailable) */
export const MAX_VIDEO_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Check once whether react-native-compressor is actually linked.
 *
 * In Expo Go we detect it via Constants.appOwnership and return false
 * immediately — this avoids the package's internal console.error that fires
 * before the thrown Error, which can't be suppressed with try/catch alone.
 */
let _compressionAvailable = undefined;
export const isCompressionAvailable = () => {
    if (_compressionAvailable === undefined) {
        // Expo Go: appOwnership === 'expo'. Skip the require entirely so the
        // package's own console.error never executes.
        if (Constants.appOwnership === 'expo') {
            _compressionAvailable = false;
            return false;
        }
        try {
            const mod = require('react-native-compressor');
            _compressionAvailable =
                mod != null && typeof mod.Video?.compress === 'function';
        } catch {
            _compressionAvailable = false;
        }
    }
    return _compressionAvailable;
};

/**
 * Return the size of a local file in bytes.
 * Returns 0 if the size cannot be determined (e.g. Expo Go sandbox).
 */
export const getFileSizeBytes = async (uri) => {
    try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        const size = info?.size ?? info?.totalSize ?? 0;
        return typeof size === 'number' ? size : 0;
    } catch {
        return 0;
    }
};

/**
 * Compress a video to ≤480p / 1.2 Mbps using react-native-compressor.
 * Only call this after confirming isCompressionAvailable() === true.
 *
 * @param {string}   uri        - local file:// URI
 * @param {function} onProgress - called with (0-100) as compression proceeds
 * @returns {Promise<string>}   - compressed file URI
 */
export const compressVideo = async (uri, onProgress) => {
    const { Video } = require('react-native-compressor');
    const compressed = await Video.compress(
        uri,
        {
            compressionMethod: 'auto',
            maxSize: 854,        // 480p equivalent
            bitrate: 1_200_000, // 1.2 Mbps ceiling
        },
        (progress) => onProgress?.(Math.min(100, Math.round(progress * 100)))
    );
    onProgress?.(100);
    return compressed;
};
