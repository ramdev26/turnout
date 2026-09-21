import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Attendee } from '../types';
import {
  applyOfflineRosterUpdates,
  countOfflineRoster,
  countPendingOfflineScans,
  enqueueOfflineScan,
  getOfflineModeEnabled,
  getOfflineRosterMeta,
  listPendingOfflineScans,
  lookupOfflineAttendee,
  markOfflineCheckedIn,
  newClientScanId,
  OfflineRosterAttendee,
  removePendingOfflineScans,
  setOfflineModeEnabled,
  upsertOfflineRoster,
} from './offlineCheckInStore';

export type OfflineCheckInResult = {
  ok: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
  attendee?: Attendee;
  queuedOffline?: boolean;
};

type RosterPageResponse = {
  ok: boolean;
  attendees: OfflineRosterAttendee[];
  nextAfterId: string | null;
  hasMore: boolean;
  total: number;
  downloadedAt: string;
};

type BatchResponse = {
  ok: boolean;
  results: Array<{
    clientScanId: string | null;
    ok: boolean;
    alreadyCheckedIn?: boolean;
    error?: string;
    message?: string;
    attendee?: Attendee;
  }>;
  synced: number;
  failed: number;
};

type DeltaResponse = {
  ok: boolean;
  updates: OfflineRosterAttendee[];
  serverTime: string;
};

function toAttendee(row: OfflineRosterAttendee, checkedInAt: string | null): Attendee {
  return {
    id: row.id,
    eventId: row.eventId,
    ticketId: '',
    ticketName: row.ticketName,
    fullName: row.fullName,
    email: row.email,
    phone: null,
    qrToken: row.qrToken,
    checkedInAt,
    createdAt: checkedInAt || new Date().toISOString(),
  };
}

export type UseOfflineCheckInOptions = {
  eventId: string;
  staffPin?: string | null;
  volunteerSessionId?: string | null;
};

export function useOfflineCheckIn({
  eventId,
  staffPin = null,
  volunteerSessionId = null,
}: UseOfflineCheckInOptions) {
  const [offlineEnabled, setOfflineEnabledState] = useState(() => getOfflineModeEnabled(eventId));
  const [rosterCount, setRosterCount] = useState(0);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [downloadedAt, setDownloadedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncingRef = useRef(false);
  const staffPinRef = useRef(staffPin);
  staffPinRef.current = staffPin;
  const volunteerSessionIdRef = useRef(volunteerSessionId);
  volunteerSessionIdRef.current = volunteerSessionId;

  const refreshStats = useCallback(async () => {
    if (!eventId) return;
    try {
      const [count, pending, meta] = await Promise.all([
        countOfflineRoster(eventId),
        countPendingOfflineScans(eventId),
        getOfflineRosterMeta(eventId),
      ]);
      setRosterCount(count);
      setPendingCount(pending);
      setRosterTotal(meta?.total ?? count);
      setDownloadedAt(meta?.downloadedAt ?? null);
    } catch {
      // ignore storage errors in stats
    }
  }, [eventId]);

  useEffect(() => {
    setOfflineEnabledState(getOfflineModeEnabled(eventId));
    void refreshStats();
  }, [eventId, refreshStats]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const setOfflineEnabled = useCallback(
    (enabled: boolean) => {
      setOfflineModeEnabled(eventId, enabled);
      setOfflineEnabledState(enabled);
      setStatusMsg(
        enabled
          ? 'Offline mode on — download the roster before doors open, then scan without signal.'
          : 'Online check-in restored'
      );
      setError(null);
    },
    [eventId]
  );

  const authBody = useCallback(() => {
    const body: Record<string, unknown> = {};
    if (staffPinRef.current) body.staffPin = staffPinRef.current;
    if (volunteerSessionIdRef.current) body.volunteerSessionId = volunteerSessionIdRef.current;
    return body;
  }, []);

  const downloadRoster = useCallback(async () => {
    if (!eventId || downloading) return;
    setDownloading(true);
    setError(null);
    setStatusMsg('Downloading attendee roster…');
    try {
      let afterId: string | null = null;
      let page = 0;
      let total = 0;
      let downloadedAtIso = new Date().toISOString();
      let first = true;

      do {
        const body: Record<string, unknown> = {
          ...authBody(),
          limit: 1000,
        };
        if (afterId) body.afterId = Number(afterId);

        const res = await api.post<RosterPageResponse>(`/api/events/${eventId}/checkin/roster`, body);
        total = res.total;
        downloadedAtIso = res.downloadedAt || downloadedAtIso;

        await upsertOfflineRoster(eventId, res.attendees || [], {
          replace: first,
          total: res.total,
          downloadedAt: downloadedAtIso,
        });
        first = false;
        afterId = res.nextAfterId;
        page += 1;
        setStatusMsg(`Downloaded page ${page} · ${Math.min(page * 1000, total)} / ${total} attendees`);
      } while (afterId);

      await refreshStats();
      setStatusMsg(`Roster ready — ${total.toLocaleString()} attendees stored on this device`);
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Could not download roster');
      setStatusMsg(null);
    } finally {
      setDownloading(false);
    }
  }, [authBody, downloading, eventId, refreshStats]);

  const pullDelta = useCallback(async () => {
    if (!eventId || !isOnline) return;
    const meta = await getOfflineRosterMeta(eventId);
    const since = meta?.lastDeltaAt || meta?.downloadedAt;
    if (!since) return;
    try {
      const res = await api.post<DeltaResponse>(`/api/events/${eventId}/checkin/roster/delta`, {
        ...authBody(),
        since,
      });
      await applyOfflineRosterUpdates(eventId, res.updates || [], res.serverTime);
      await refreshStats();
    } catch {
      // delta is best-effort
    }
  }, [authBody, eventId, isOnline, refreshStats]);

  const syncPending = useCallback(async () => {
    if (!eventId || syncingRef.current || !isOnline) return;
    const pending = await listPendingOfflineScans(eventId);
    if (pending.length === 0) {
      await pullDelta();
      return;
    }

    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    setStatusMsg(`Syncing ${pending.length} offline scan${pending.length === 1 ? '' : 's'}…`);

    try {
      const chunkSize = 100;
      let syncedTotal = 0;
      let failedTotal = 0;

      for (let i = 0; i < pending.length; i += chunkSize) {
        const chunk = pending.slice(i, i + chunkSize);
        const res = await api.post<BatchResponse>(`/api/events/${eventId}/checkin/batch`, {
          ...authBody(),
          scans: chunk.map((s) => ({
            clientScanId: s.clientScanId,
            qrToken: s.qrToken,
            scannedAt: s.scannedAt,
          })),
        });

        const doneIds: string[] = [];
        for (const result of res.results || []) {
          if (result.clientScanId && result.ok) {
            doneIds.push(result.clientScanId);
            if (result.attendee?.qrToken) {
              await markOfflineCheckedIn(
                eventId,
                result.attendee.qrToken,
                result.attendee.checkedInAt || new Date().toISOString()
              );
            }
          } else if (result.clientScanId && result.error === 'attendee_not_found') {
            // Drop unknown tokens so they don't block the queue forever.
            doneIds.push(result.clientScanId);
            failedTotal += 1;
          } else if (!result.ok) {
            failedTotal += 1;
          }
        }
        syncedTotal += res.synced || doneIds.length;
        await removePendingOfflineScans(doneIds);
      }

      await pullDelta();
      await refreshStats();
      if (failedTotal > 0) {
        setStatusMsg(`Synced ${syncedTotal} · ${failedTotal} need attention`);
      } else {
        setStatusMsg(`All offline scans synced (${syncedTotal})`);
      }
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Sync failed — will retry when online');
      setStatusMsg(null);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [authBody, eventId, isOnline, pullDelta, refreshStats]);

  useEffect(() => {
    if (!offlineEnabled || !isOnline) return;
    void syncPending();
    const t = window.setInterval(() => {
      void syncPending();
    }, 20000);
    return () => window.clearInterval(t);
  }, [offlineEnabled, isOnline, syncPending]);

  const performOfflineCheckIn = useCallback(
    async (qrToken: string): Promise<OfflineCheckInResult> => {
      const row = await lookupOfflineAttendee(eventId, qrToken);
      if (!row) {
        return {
          ok: false,
          message:
            'Ticket not in the offline roster. Re-download the roster when you have signal, or switch to online mode.',
        };
      }

      if (row.checkedInAt) {
        return {
          ok: true,
          alreadyCheckedIn: true,
          message: `${row.fullName} was already checked in.`,
          attendee: toAttendee(row, row.checkedInAt),
        };
      }

      const scannedAt = new Date().toISOString();
      const updated = await markOfflineCheckedIn(eventId, qrToken, scannedAt);
      const clientScanId = newClientScanId();
      await enqueueOfflineScan({
        clientScanId,
        eventId,
        qrToken,
        scannedAt,
        fullName: row.fullName,
        email: row.email,
        ticketName: row.ticketName,
      });
      await refreshStats();

      if (isOnline) {
        void syncPending();
      }

      return {
        ok: true,
        alreadyCheckedIn: false,
        queuedOffline: true,
        message: `Welcome, ${row.fullName}!${isOnline ? '' : ' Saved offline — will sync when online.'}`,
        attendee: toAttendee(updated || row, scannedAt),
      };
    },
    [eventId, isOnline, refreshStats, syncPending]
  );

  return {
    offlineEnabled,
    setOfflineEnabled,
    rosterCount,
    rosterTotal,
    pendingCount,
    downloadedAt,
    isOnline,
    downloading,
    syncing,
    statusMsg,
    error,
    downloadRoster,
    syncPending,
    performOfflineCheckIn,
    refreshStats,
    hasRoster: rosterCount > 0,
  };
}
