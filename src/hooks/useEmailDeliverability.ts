import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkEmailDeliverability,
  type EmailDeliverabilityResult,
} from '../lib/plunkEmailVerify';

type Options = {
  /** Debounce delay before calling Plunk verify (ms). */
  delayMs?: number;
  enabled?: boolean;
};

export function useEmailDeliverability(email: string, options: Options = {}) {
  const delayMs = options.delayMs ?? 450;
  const enabled = options.enabled !== false;
  const [result, setResult] = useState<EmailDeliverabilityResult | null>(null);
  const [checking, setChecking] = useState(false);
  const requestId = useRef(0);

  const runCheck = useCallback(async (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setResult(null);
      setChecking(false);
      return null;
    }
    const id = ++requestId.current;
    setChecking(true);
    const next = await checkEmailDeliverability(trimmed);
    if (id !== requestId.current) return null;
    setResult(next);
    setChecking(false);
    return next;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handle = window.setTimeout(() => {
      void runCheck(email);
    }, delayMs);
    return () => window.clearTimeout(handle);
  }, [email, delayMs, enabled, runCheck]);

  const clear = useCallback(() => {
    requestId.current += 1;
    setResult(null);
    setChecking(false);
  }, []);

  return {
    checking,
    result,
    deliverable: result ? result.deliverable : true,
    suggestedEmail: result?.suggestedEmail || null,
    message: result && !result.deliverable ? result.message || 'This email does not look deliverable.' : null,
    recheck: runCheck,
    clear,
  };
}
