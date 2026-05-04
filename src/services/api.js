import { compressVideo, getFileSizeBytes, MAX_VIDEO_SIZE_BYTES, isCompressionAvailable } from './videoCompressor';
import { API_BASE_URL } from '../constants/config';

/**
 * Submit a traffic violation report.
 *
 * For video files:
 *   1. Compresses to ≤480p / 1.2 Mbps before upload.
 *   2. Rejects if the compressed size still exceeds MAX_VIDEO_SIZE_BYTES.
 *
 * @param {object}   params
 * @param {function} onProgress - ({ phase: 'compressing'|'uploading', percent: 0-100 }) => void
 */
export const submitReport = async (params, onProgress = () => {}) => {
    const {
        file,
        latitude,
        longitude,
        locationDescription,
        violationType,
        description,
        vehiclePlate,
        vehicleColor,
        vehicleMake,
    } = params;

    let uploadUri = file.uri;

    // ── Step 1: Video size-check + optional compression ───────────────────────
    if (file.isVideo) {
        const canCompress = isCompressionAvailable();
        const originalSize = await getFileSizeBytes(file.uri);
        const sizeKnown = originalSize > 0;

        if (canCompress) {
            // ── EAS / Dev Build path: full compression ────────────────────────
            // Reject files that are clearly too large to bother compressing
            if (sizeKnown && originalSize > MAX_VIDEO_SIZE_BYTES * 4) {
                const mb = (originalSize / 1024 / 1024).toFixed(0);
                throw new Error(
                    `Video is too large (${mb} MB). Please select a shorter clip.`
                );
            }

            onProgress({ phase: 'compressing', percent: 0 });
            const compressedUri = await compressVideo(file.uri, (pct) =>
                onProgress({ phase: 'compressing', percent: pct })
            );

            const compressedSize = await getFileSizeBytes(compressedUri);
            if (compressedSize > 0 && compressedSize > MAX_VIDEO_SIZE_BYTES) {
                const mb = (compressedSize / 1024 / 1024).toFixed(1);
                throw new Error(
                    `Compressed video is still too large (${mb} MB). Please record a shorter clip.`
                );
            }

            uploadUri = compressedUri;
            if (sizeKnown && compressedSize > 0) {
                console.log(
                    `📹 Compressed: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ` +
                    `${(compressedSize / 1024 / 1024).toFixed(2)} MB`
                );
            }
        } else {
            // ── Expo Go path: raw upload — enforce strict size limit ──────────
            if (sizeKnown && originalSize > MAX_VIDEO_SIZE_BYTES) {
                const mb = (originalSize / 1024 / 1024).toFixed(1);
                throw new Error(
                    `Video is too large to upload without compression (${mb} MB).\n\n` +
                    `Please use the camera to record a fresh 15-second clip — ` +
                    `those are recorded at 480p and stay well under 5 MB.`
                );
            }
            if (sizeKnown) {
                console.log(`📹 Uploading raw (${(originalSize / 1024 / 1024).toFixed(2)} MB) — Expo Go, no compressor`);
            }
        }
    }

    // ── Step 2: Upload with XHR (supports progress events) ───────────────────
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        const ext = file.isVideo ? 'mp4' : 'jpg';

        formData.append('file', {
            uri: uploadUri,
            type: file.type || (file.isVideo ? 'video/mp4' : 'image/jpeg'),
            name: `report_${Date.now()}.${ext}`,
        });

        if (latitude !== undefined && latitude !== null)
            formData.append('latitude', latitude.toString());
        if (longitude !== undefined && longitude !== null)
            formData.append('longitude', longitude.toString());
        if (locationDescription)
            formData.append('location_description', locationDescription);
        if (violationType)
            formData.append('violation_type', violationType);
        if (description)
            formData.append('description', description);
        if (vehiclePlate)
            formData.append('vehicle_plate', vehiclePlate);
        if (vehicleColor)
            formData.append('vehicle_color', vehicleColor);
        if (vehicleMake)
            formData.append('vehicle_make', vehicleMake);

        const xhr = new XMLHttpRequest();
        xhr.timeout = 120_000; // 2-minute ceiling

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                onProgress({
                    phase: 'uploading',
                    // Clamp to [0, 100] — floating-point edge cases can push this above 100
                    percent: Math.min(100, Math.max(0, Math.round((e.loaded / e.total) * 100))),
                });
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    resolve({ status: 'success' });
                }
            } else if (xhr.status === 404) {
                reject(new Error(
                    'Could not reach the server (404).\n\n' +
                    'The backend may be offline or the ngrok tunnel has expired. ' +
                    'Restart the backend and update API_BASE_URL in src/constants/config.js.'
                ));
            } else {
                let detail = `Server error: ${xhr.status}`;
                try { detail = JSON.parse(xhr.responseText)?.detail || detail; } catch {}
                reject(new Error(detail));
            }
        });

        xhr.addEventListener('error', () =>
            reject(new Error('Network request failed. Please check your connection.'))
        );
        xhr.addEventListener('timeout', () =>
            reject(new Error('Upload timed out. Please try on a faster connection.'))
        );

        xhr.open('POST', `${API_BASE_URL}/report`);
        // Do NOT set Content-Type manually — XHR sets multipart/form-data with boundary automatically
        xhr.send(formData);
    });
};
