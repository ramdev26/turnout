import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

let configured = false;
let loadPromise: Promise<typeof google> | null = null;
let resolvedApiKey: string | null = null;
let resolveKeyPromise: Promise<string> | null = null;

function envApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

/** Resolve browser Maps key from Vite env or runtime public API config (Vercel). */
export async function resolveGoogleMapsApiKey(): Promise<string> {
  if (resolvedApiKey) return resolvedApiKey;

  const fromEnv = envApiKey();
  if (fromEnv) {
    resolvedApiKey = fromEnv;
    return fromEnv;
  }

  if (!resolveKeyPromise) {
    resolveKeyPromise = fetch('/api/public/config', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return '';
        const data = (await res.json()) as { googleMapsApiKey?: string };
        return (data.googleMapsApiKey || '').trim();
      })
      .catch(() => '');
  }

  const fromApi = await resolveKeyPromise;
  if (fromApi) resolvedApiKey = fromApi;
  return fromApi;
}

export function isGoogleMapsConfigured(): boolean {
  return envApiKey().length > 0 || resolvedApiKey !== null;
}

export async function checkGoogleMapsConfigured(): Promise<boolean> {
  const key = await resolveGoogleMapsApiKey();
  return key.length > 0;
}

function mapsErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/RefererNotAllowedMapError/i.test(message)) {
    return 'Google Maps key is not allowed for this website URL. Add your domain in Google Cloud Console API key restrictions.';
  }
  if (/ApiNotActivatedMapError|not activated/i.test(message)) {
    return 'Enable Maps JavaScript API and Places API on your Google Cloud project.';
  }
  if (/InvalidKeyMapError|invalid.*key/i.test(message)) {
    return 'Google Maps API key is invalid. Check VITE_GOOGLE_MAPS_API_KEY in your deployment settings.';
  }
  if (/OVER_QUERY_LIMIT|quota/i.test(message)) {
    return 'Google Maps quota exceeded. Check billing in Google Cloud Console.';
  }
  return message || 'Google Maps failed to load';
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof google !== 'undefined' && google.maps?.places) {
    return Promise.resolve(google);
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const apiKey = await resolveGoogleMapsApiKey();
      if (!apiKey) {
        throw new Error('VITE_GOOGLE_MAPS_API_KEY is not set');
      }

      if (!configured) {
        setOptions({
          key: apiKey,
          v: 'weekly',
          region: 'LK',
          language: 'en',
        });
        configured = true;
      }

      await Promise.all([importLibrary('maps'), importLibrary('places')]);
      if (typeof google === 'undefined' || !google.maps?.places) {
        throw new Error('Google Places library did not load');
      }
      return google;
    })().catch((err) => {
      loadPromise = null;
      throw new Error(mapsErrorMessage(err));
    });
  }

  return loadPromise;
}
