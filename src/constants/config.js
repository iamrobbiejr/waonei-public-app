/**
 * Central config for the mobile app.
 *
 * ── HOW TO UPDATE THE NGROK URL ─────────────────────────────────────────────
 * 1. Start your backend:   uvicorn app.main:app --reload
 * 2. Start ngrok:          ngrok http 8000
 * 3. Copy the Forwarding URL (e.g. https://xxxx.ngrok-free.app)
 * 4. Paste it below (no trailing slash)
 * 5. Save — Expo hot-reload picks it up instantly, no rebuild needed
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const API_BASE_URL = 'https://90cf-2605-59c0-6773-c210-cc13-18e8-ffc9-44f5.ngrok-free.app';
