const API_BASE_URL = 'https://7aab616e42b2.ngrok-free.app';

export const submitReport = async ({
    file,
    latitude,
    longitude,
    locationDescription,
    violationType,
    description,
    vehiclePlate,
    vehicleColor,
    vehicleMake,
}) => {
    try {
        const formData = new FormData();

        // Add the file
        formData.append('file', {
            uri: file.uri,
            type: file.type || 'image/jpeg',
            name: file.fileName || `report_${Date.now()}.${file.type?.includes('video') ? 'mp4' : 'jpg'}`,
        });

        // Add optional fields
        if (latitude !== undefined && latitude !== null) {
            formData.append('latitude', latitude.toString());
        }
        if (longitude !== undefined && longitude !== null) {
            formData.append('longitude', longitude.toString());
        }
        if (locationDescription) {
            formData.append('location_description', locationDescription);
        }
        if (violationType) {
            formData.append('violation_type', violationType);
        }
        if (description) {
            formData.append('description', description);
        }
        if (vehiclePlate) {
            formData.append('vehicle_plate', vehiclePlate);
        }
        if (vehicleColor) {
            formData.append('vehicle_color', vehicleColor);
        }
        if (vehicleMake) {
            formData.append('vehicle_make', vehicleMake);
        }

        const response = await fetch(`${API_BASE_URL}/report`, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error submitting report:', error);
        throw error;
    }
};
