export type ApiError = {
  error: string;
  message?: string;
};

import { getAuthToken } from './authToken';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export function toApiUrl(path: string): string {
  if (!apiBaseUrl) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Paths already include /api/...; avoid https://host/api/api/... when base ends with /api.
  if (apiBaseUrl.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${apiBaseUrl}${normalizedPath.slice(4)}`;
  }
  return `${apiBaseUrl}${normalizedPath}`;
}

function invalidSuccessPayload(text: string, status: number): ApiError {
  const trimmed = text.trim();
  const looksHtml = /^\s*</.test(trimmed) || trimmed.toLowerCase().includes('<!doctype');
  const looksPhpError = /parse error|fatal error|warning:/i.test(trimmed);
  if (looksPhpError) {
    return {
      error: 'api_server_error',
      message:
        'The API failed on the server (deployment error). Redeploy the latest build or check Vercel function logs for PHP errors.',
    };
  }
  if (looksHtml) {
    return {
      error: 'invalid_api_response',
      message:
        'Received a web page instead of API data. Leave VITE_API_BASE_URL unset on Vercel, or set it to your site origin only (no /api suffix).',
    };
  }
  if (!trimmed) {
    return {
      error: 'invalid_api_response',
      message:
        'The server returned an empty response. Start the PHP API locally or check VITE_API_BASE_URL / deployment settings.',
    };
  }
  return {
    error: 'invalid_api_response',
    message: `Unexpected server response (HTTP ${status}). Check API configuration and try again.`,
  };
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(toApiUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  let data: Record<string, unknown> | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw {
        error: 'unauthorized',
        message: (data?.message as string) || 'Your session has expired. Please sign in again.',
      } as ApiError;
    }

    const fallback: ApiError = {
      error: (data?.error as string) || (data?.message as string) || `request_failed_${res.status}`,
      message:
        (data?.message as string) ||
        (text && !/^\s*</.test(text) ? text.slice(0, 240) : `Request failed (HTTP ${res.status}).`),
      ...(data || {}),
    };
    throw fallback;
  }

  if (data === null || typeof data !== 'object') {
    throw invalidSuccessPayload(text, res.status);
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
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
