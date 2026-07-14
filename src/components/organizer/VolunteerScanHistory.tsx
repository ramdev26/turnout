import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { cardMutedStyleFor, cardStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';
import { CheckCircle2, Clock, History, RefreshCw } from 'lucide-react';

export type VolunteerScanRecord = {
  id: string;
  attendeeId: string | null;
  fullName: string;
  ticketName: string;
  email: string;
  outcome: 'success' | 'already_checked_in';
  scannedAt: string | null;
};

type VolunteerScanHistoryProps = {
  eventId: string;
  staffPin: string;
  volunteerSessionId: string;
  refreshKey?: number;
  className?: string;
};

function formatScanTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export const VolunteerScanHistory: React.FC<VolunteerScanHistoryProps> = ({
  eventId,
  staffPin,
  volunteerSessionId,
  refreshKey = 0,
  className,
}) => {
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const [scans, setScans] = useState<VolunteerScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!eventId || !staffPin || !volunteerSessionId) return;
      if (opts?.background) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          staffPin,
          volunteerSessionId,
          limit: '100',
        });
        const res = await api.get<{ scans: VolunteerScanRecord[] }>(
          `/api/events/${eventId}/checkin/scans?${params.toString()}`
        );
        setScans(res.scans || []);
      } catch {
        if (!opts?.background) setScans([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, staffPin, volunteerSessionId]
  );

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const successCount = scans.filter((s) => s.outcome === 'success').length;

  return (
    <section className={cn('rounded-2xl border', className)} style={cardStyle}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: ui.borderColor }}>
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" style={{ color: ui.accent }} />
          <div>
            <h2 className="text-sm font-semibold" style={{ color: ui.text }}>
              My scan history
            </h2>
            <p className="text-xs" style={{ color: ui.textMuted }}>
              {successCount} checked in this session
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load({ background: true })}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ ...cardMutedStyle, color: ui.text }}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="max-h-[min(42vh,320px)] overflow-y-auto px-2 py-2">
        {loading ? (
          <p className="px-2 py-6 text-center text-sm" style={{ color: ui.textMuted }}>
            Loading your scans…
          </p>
        ) : scans.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm" style={{ color: ui.textMuted }}>
            No scans yet. Your check-ins will appear here.
          </p>
        ) : (
          <ul className="space-y-1">
            {scans.map((scan) => {
              const isSuccess = scan.outcome === 'success';
              return (
                <li
                  key={scan.id}
                  className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                  style={cardMutedStyle}
                >
                  <div
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
                    style={{
                      background: isSuccess ? ui.accentSoft : 'rgba(245, 158, 11, 0.15)',
                      color: isSuccess ? ui.accent : '#fbbf24',
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: ui.text }}>
                      {scan.fullName || 'Guest'}
                    </p>
                    <p className="truncate text-xs" style={{ color: ui.textMuted }}>
                      {scan.ticketName}
                      {scan.email ? ` · ${scan.email}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs font-medium" style={{ color: isSuccess ? ui.accent : '#fbbf24' }}>
                      {isSuccess ? 'Checked in' : 'Already checked in'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs" style={{ color: ui.textSubtle }}>
                    <Clock className="h-3 w-3" />
                    {formatScanTime(scan.scannedAt)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
