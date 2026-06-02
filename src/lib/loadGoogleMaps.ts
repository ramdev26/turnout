import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let configured = false;
let loadPromise: Promise<typeof google> | null = null;

function getApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

export function isGoogleMapsConfigured(): boolean {
  return getApiKey().length > 0;
}

/**
 * Load Maps JS API with Places library (singleton).
 */
export function loadGoogleMaps(): Promise<typeof google> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'));
  }

  if (typeof google !== 'undefined' && google.maps?.places) {
    return Promise.resolve(google);
  }

  if (!configured) {
    setOptions({ key: apiKey, v: 'weekly' });
    configured = true;
  }

  if (!loadPromise) {
    loadPromise = importLibrary('places')
      .then(() => google)
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }

  return loadPromise;
}
