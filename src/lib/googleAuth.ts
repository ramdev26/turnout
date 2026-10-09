export type GoogleAuthRole = 'organizer' | 'attendee';

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GoogleAccountsOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => GoogleTokenClient;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: string;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: Record<string, string | number>
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
        oauth2?: GoogleAccountsOAuth2;
      };
    };
  }
}

const GIS_SCRIPT_ID = 'turnout-google-gsi';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<void> | null = null;
let configPromise: Promise<{ clientId: string; configured: boolean }> | null = null;

export async function loadGoogleOAuthConfig(): Promise<{ clientId: string; configured: boolean }> {
  if (!configPromise) {
    configPromise = fetch('/api/public/config', { credentials: 'same-origin' })
      .then(async (res) => {
        if (!res.ok) return { clientId: '', configured: false };
        const data = (await res.json()) as {
          googleOAuthClientId?: string;
          googleAuthConfigured?: boolean;
        };
        const clientId = (data.googleOAuthClientId || '').trim();
        return {
          clientId,
          configured: Boolean(data.googleAuthConfigured) && clientId !== '',
        };
      })
      .catch(() => ({ clientId: '', configured: false }));
  }
  return configPromise;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in')));
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Google sign-in'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function createGoogleTokenClient(
  clientId: string,
  onToken: (accessToken: string) => void,
  onError: (message: string) => void
): Promise<GoogleTokenClient | null> {
  if (!clientId) return null;
  await loadGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) return null;

  return oauth2.initTokenClient({
    client_id: clientId,
    scope: 'openid email profile',
    callback: (response) => {
      if (response.error || !response.access_token) {
        onError(response.error_description || response.error || 'Google sign-in was cancelled.');
        return;
      }
      onToken(response.access_token);
    },
    error_callback: (error) => {
      const type = (error?.type || '').toLowerCase();
      if (type === 'popup_closed') {
        onError('Google sign-in was closed before finishing.');
        return;
      }
      onError(error?.message || 'Google sign-in failed.');
    },
  });
}
