import type { ApiError } from './client';
import type { UserProfile } from '../types';

export type AuthApiPayload = {
  user: UserProfile;
  authToken?: string;
  sessionToken?: string;
  forcePasswordReset?: boolean;
};

function invalidAuthPayload(message: string): ApiError {
  return { error: 'invalid_auth_response', message };
}

/** Validates login/register/me responses before reading `.user`. */
export function parseAuthPayload(data: unknown): AuthApiPayload {
  if (!data || typeof data !== 'object') {
    throw invalidAuthPayload(
      'Sign-in did not return account data. Check that the API is reachable and VITE_API_BASE_URL is set to your site origin only (not …/api).'
    );
  }
  const record = data as Record<string, unknown>;
  const user = record.user;
  if (!user || typeof user !== 'object') {
    throw invalidAuthPayload(
      'Sign-in response was missing your profile. Try again; if it persists, the API may be misconfigured.'
    );
  }
  return {
    user: user as UserProfile,
    authToken: typeof record.authToken === 'string' ? record.authToken : undefined,
    sessionToken: typeof record.sessionToken === 'string' ? record.sessionToken : undefined,
    forcePasswordReset: Boolean(record.forcePasswordReset),
  };
}
