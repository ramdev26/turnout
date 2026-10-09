export type GoogleAuthRole = 'organizer' | 'attendee';

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
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      logo_alignment?: string;
      width?: number;
    }
  ) => void;
  prompt?: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
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
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in')));
      if (window.google?.accounts?.id) resolve();
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

export async function prepareGoogleIdentity(clientId: string): Promise<GoogleAccountsId | null> {
  if (!clientId) return null;
  await loadGoogleIdentityScript();
  return window.google?.accounts?.id ?? null;
}
