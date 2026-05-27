const AUTH_TOKEN_KEY = 'turnout_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token && token.trim() !== '') {
      localStorage.setItem(AUTH_TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export function persistAuthTokenFromResponse(
  data: { authToken?: string; sessionToken?: string } | null | undefined
): void {
  const token = data?.authToken || data?.sessionToken;
  if (token && typeof token === 'string') {
    setAuthToken(token);
  }
}
