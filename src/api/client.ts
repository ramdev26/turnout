export type ApiError = {
  error: string;
  message?: string;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function toApiUrl(path: string): string {
  if (!apiBaseUrl) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${apiBaseUrl}${path}`;
  return `${apiBaseUrl}/${path}`;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(toApiUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      credentials: 'include',
      signal: controller.signal,
    });
  } catch {
    const isProduction = import.meta.env.PROD;
    const guidance = isProduction
      ? 'API server is not reachable. Configure VITE_API_BASE_URL in your Vercel project environment variables and redeploy.'
      : 'API server is not reachable. Start backend or set VITE_API_BASE_URL in .env.local.';
    throw {
      error: 'api_unreachable',
      message: guidance,
    } as ApiError;
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw {
        error: 'unauthorized',
        message: 'Your session has expired. Please sign in again.',
      } as ApiError;
    }

    const fallback: ApiError = {
      error: data?.error || data?.message || `request_failed_${res.status}`,
      message:
        data?.message ||
        (text && !/^\s*</.test(text) ? text.slice(0, 240) : `Request failed (HTTP ${res.status}).`),
    };
    throw fallback;
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};

