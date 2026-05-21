/**
 * Normalize and parse values scanned from ticket QR codes.
 * Supports: raw 32-char hex token, JSON { eventId, qrToken }, URLs with query params.
 */
export function normalizeQrToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const fromJson = String(parsed.qrToken ?? parsed.token ?? '').trim();
      const hex = extractHexToken(fromJson);
      if (hex) return hex;
    } catch {
      // fall through
    }
  }

  if (trimmed.includes('://') || trimmed.includes('qrToken=') || trimmed.includes('token=')) {
    try {
      const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`https://local/?${trimmed.replace(/^\?/, '')}`);
      const qp = url.searchParams.get('qrToken') || url.searchParams.get('token') || '';
      const hex = extractHexToken(qp);
      if (hex) return hex;
    } catch {
      // fall through
    }
  }

  return extractHexToken(trimmed);
}

function extractHexToken(value: string): string {
  const hex = value.replace(/[^a-fA-F0-9]/g, '');
  if (hex.length === 32) return hex.toLowerCase();
  // Some scanners glue extra characters — take first valid 32-char run
  const match = value.match(/[a-fA-F0-9]{32}/);
  return match ? match[0].toLowerCase() : '';
}

export type ParsedQrScan = {
  qrToken: string;
  scannedEventId?: string;
  error?: 'empty' | 'invalid' | 'wrong_event';
};

export function parseQrCheckInPayload(raw: string, expectedEventId?: string): ParsedQrScan {
  const trimmed = raw.trim();
  if (!trimmed) return { qrToken: '', error: 'empty' };

  let scannedEventId: string | undefined;

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.eventId != null) scannedEventId = String(parsed.eventId);
    } catch {
      // continue with token extraction
    }
  }

  const qrToken = normalizeQrToken(trimmed);
  if (!qrToken) return { qrToken: '', error: 'invalid' };

  if (expectedEventId && scannedEventId && scannedEventId !== expectedEventId) {
    return { qrToken, scannedEventId, error: 'wrong_event' };
  }

  return { qrToken, scannedEventId };
}
