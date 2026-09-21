import React from 'react';
import {
  CloudOff,
  Download,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';

export type OfflineCheckInControlsProps = {
  offlineEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  rosterCount: number;
  rosterTotal: number;
  pendingCount: number;
  downloadedAt: string | null;
  isOnline: boolean;
  downloading: boolean;
  syncing: boolean;
  hasRoster: boolean;
  statusMsg: string | null;
  error: string | null;
  onDownload: () => void;
  onSync: () => void;
  className?: string;
};

function formatDownloadedAt(iso: string | null): string {
  if (!iso) return 'Not downloaded yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not downloaded yet';
  return d.toLocaleString();
}

export const OfflineCheckInControls: React.FC<OfflineCheckInControlsProps> = ({
  offlineEnabled,
  onToggle,
  rosterCount,
  rosterTotal,
  pendingCount,
  downloadedAt,
  isOnline,
  downloading,
  syncing,
  hasRoster,
  statusMsg,
  error,
  onDownload,
  onSync,
  className,
}) => {
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const accentBtn = accentButtonStyleFor(ui);

  return (
    <div className={cn('rounded-2xl border p-4 sm:p-5', className)} style={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
            <CloudOff className="h-4 w-4 shrink-0" style={{ color: ui.accent }} />
            Offline scans
          </div>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            For large events or weak signal: download the guest list once, keep scanning at the door, then sync when
            you&apos;re back online.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={offlineEnabled}
          onClick={() => onToggle(!offlineEnabled)}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
          style={{
            ...cardMutedStyle,
            color: offlineEnabled ? ui.accent : ui.text,
            borderColor: offlineEnabled ? ui.accent : ui.borderColor,
          }}
        >
          {offlineEnabled ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
          {offlineEnabled ? 'Offline on' : 'Offline off'}
        </button>
      </div>

      {offlineEnabled && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border px-3 py-2" style={cardMutedStyle}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Roster
              </p>
              <p className="mt-0.5 text-sm font-semibold" style={{ color: ui.text }}>
                {rosterCount.toLocaleString()}
                {rosterTotal > 0 && rosterTotal !== rosterCount
                  ? ` / ${rosterTotal.toLocaleString()}`
                  : ''}
              </p>
            </div>
            <div className="rounded-xl border px-3 py-2" style={cardMutedStyle}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Waiting to sync
              </p>
              <p className="mt-0.5 text-sm font-semibold" style={{ color: ui.text }}>
                {pendingCount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border px-3 py-2" style={cardMutedStyle}>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Network
              </p>
              <p className="mt-0.5 text-sm font-semibold" style={{ color: ui.text }}>
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          <p className="text-xs" style={{ color: ui.textSubtle }}>
            Last download: {formatDownloadedAt(downloadedAt)}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="turnout-btn-accent inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={accentBtn}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? 'Downloading…' : hasRoster ? 'Refresh roster' : 'Download roster'}
            </button>
            <button
              type="button"
              onClick={onSync}
              disabled={syncing || !isOnline || pendingCount < 1}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ ...cardMutedStyle, color: ui.text }}
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing…' : pendingCount > 0 ? `Sync ${pendingCount}` : 'Nothing to sync'}
            </button>
          </div>

          {!hasRoster && (
            <p
              className="rounded-xl border px-3 py-2 text-xs"
              style={{ borderColor: '#fbbf24', background: 'rgba(245,158,11,0.12)', color: ui.text }}
            >
              Download the roster while you still have signal — scanners need it before going offline.
            </p>
          )}

          {statusMsg && (
            <p className="text-xs font-medium" style={{ color: ui.accent }}>
              {statusMsg}
            </p>
          )}
          {error && <p className="text-xs font-medium text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
};
