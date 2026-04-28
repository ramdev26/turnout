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
  let res: Response;
  try {
    res = await fetch(toApiUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      credentials: 'include',
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
    const fallback: ApiError = {
      error: data?.error || data?.message || `request_failed_${res.status}`,
      message: data?.message || (text ? text.slice(0, 240) : `HTTP ${res.status}`),
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

