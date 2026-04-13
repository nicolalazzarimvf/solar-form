/**
 * Environment configuration
 *
 * In Vite, environment variables must be prefixed with VITE_
 * to be exposed to the client-side code.
 *
 * Usage:
 *   import { config } from './config/env';
 *   const apiKey = config.googleMapsApiKey;
 */

export const config = {
  // Google APIs
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',

  // Ideal Postcodes API
  idealPostcodesApiKey: import.meta.env.VITE_IDEAL_POSTCODES_API_KEY || '',

  // MVF Supabase functions base (same project as optimizely CONFIG.getAvailabilityApiUrl).
  // React: get-availability, book-appointment. Parent: .../appointments/{submissionId} (see optimizely.js).
  projectSolarMvfApiUrl: import.meta.env.VITE_PROJECT_SOLAR_MVF_API_URL || 'https://sejpbjqjfxmehyvlweil.supabase.co/functions/v1',
  projectSolarMvfApiKey: import.meta.env.VITE_PROJECT_SOLAR_MVF_API_KEY || '',

  // Environment
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  mode: import.meta.env.MODE,
};

/**
 * Validate required environment variables
 * Call this on app startup to ensure all required vars are set
 */
export function validateEnv() {
  const required = [
    'VITE_GOOGLE_MAPS_API_KEY',
    'VITE_IDEAL_POSTCODES_API_KEY',
  ];

  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0 && import.meta.env.PROD) {
    console.error('Missing required environment variables:', missing);
    return false;
  }

  if (missing.length > 0 && import.meta.env.DEV) {
    console.warn('Missing environment variables (dev mode):', missing);
  }

  return true;
}

export default config;
