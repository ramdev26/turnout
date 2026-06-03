/** Extract a user-facing message from API client throws (plain objects, not Error). */
export function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (err && typeof err === 'object') {
    const e = err as { message?: string; error?: string };
    if (typeof e.message === 'string' && e.message.trim() !== '') {
      return e.message;
    }
    if (typeof e.error === 'string' && e.error.trim() !== '') {
      return e.error;
    }
  }
  return fallback;
}
