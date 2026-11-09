import { api } from '../api/client';

export type EmailVerificationDetails = {
  valid?: boolean | null;
  isDisposable?: boolean | null;
  isTypo?: boolean | null;
  hasMxRecords?: boolean | null;
  domainExists?: boolean | null;
  isPersonalEmail?: boolean | null;
  reasons?: string[];
};

export type EmailDeliverabilityResult = {
  ok: boolean;
  deliverable: boolean;
  skipped: boolean;
  email: string;
  suggestedEmail?: string | null;
  message?: string;
  verification?: EmailVerificationDetails;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Call Plunk verifyEmail via the Turnout API (`POST /v1/verify`). */
export async function checkEmailDeliverability(rawEmail: string): Promise<EmailDeliverabilityResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return {
      ok: false,
      deliverable: false,
      skipped: false,
      email,
      message: 'Enter a valid email address.',
    };
  }

  try {
    const res = await api.post<EmailDeliverabilityResult>('/api/auth/check-email', { email });
    return {
      ok: Boolean(res.ok),
      deliverable: res.deliverable !== false,
      skipped: Boolean(res.skipped),
      email: (res.email || email).trim().toLowerCase(),
      suggestedEmail: res.suggestedEmail || null,
      message: res.message,
      verification: res.verification,
    };
  } catch (e: unknown) {
    const err = e as { message?: string; suggestedEmail?: string; verification?: EmailVerificationDetails };
    // Soft-fail open on transport errors so signup/checkout stay usable if Plunk is down.
    return {
      ok: true,
      deliverable: true,
      skipped: true,
      email,
      suggestedEmail: err?.suggestedEmail || null,
      message: err?.message || 'Could not verify email right now.',
      verification: err?.verification,
    };
  }
}
