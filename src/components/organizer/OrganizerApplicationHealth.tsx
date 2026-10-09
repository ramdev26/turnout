import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CheckCircle2, Circle, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { OrganizerApplicationHealth } from '../../types';
import { formatApiError } from '../../utils/apiError';
import { FlowAlert, FlowButton, FlowCard } from '../flow/FlowPrimitives';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { cardMutedStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';

type Props = {
  onError?: (message: string) => void;
};

function scoreColor(score: number, accent: string): string {
  if (score >= 90) return '#34d399';
  if (score >= 75) return accent;
  if (score >= 55) return '#fbbf24';
  return '#fb7185';
}

export const OrganizerApplicationHealthPanel: React.FC<Props> = ({ onError }) => {
  const ui = APP_FLOW_UI;
  const [health, setHealth] = useState<OrganizerApplicationHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ health: OrganizerApplicationHealth }>('/api/organizer/application-health');
      setHealth(res.health);
    } catch (e: unknown) {
      const message = formatApiError(e, 'Failed to load application health');
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !health) {
    return (
      <FlowCard>
        <p className="text-sm" style={{ color: ui.textMuted }}>
          Loading application health…
        </p>
      </FlowCard>
    );
  }

  if (!health) {
    return error ? <FlowAlert variant="error">{error}</FlowAlert> : null;
  }

  const ring = scoreColor(health.score, ui.accent);
  const visibleItems = showAll ? health.items : health.pending.length > 0 ? health.pending : health.items.slice(0, 4);

  return (
    <FlowCard>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex items-center gap-4 lg:w-[220px] lg:shrink-0 lg:flex-col lg:items-start">
          <div
            className="relative grid h-24 w-24 place-items-center rounded-full"
            style={{
              background: `conic-gradient(${ring} ${health.score * 3.6}deg, ${ui.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} 0)`,
            }}
            aria-label={`Application health score ${health.score} out of 100`}
          >
            <div
              className="grid h-[4.75rem] w-[4.75rem] place-items-center rounded-full"
              style={{ background: ui.cardBg || ui.pageBg, color: ui.text }}
            >
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums leading-none">{health.score}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                  / 100
                </p>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: ui.accent }} />
              <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
                Application health
              </h2>
            </div>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              <span className="font-semibold" style={{ color: ring }}>
                {health.grade} · {health.label}
              </span>
              {' · '}
              {health.completed}/{health.total} complete
            </p>
            <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
              {health.pendingCount > 0
                ? `${health.pendingCount} item${health.pendingCount === 1 ? '' : 's'} still pending on your side.`
                : 'Everything on the checklist is complete.'}
            </p>
            <FlowButton
              type="button"
              variant="ghost"
              className="mt-3 !px-0"
              disabled={refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </FlowButton>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            {health.categories.map((cat) => (
              <span
                key={cat.id}
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  borderColor: ui.borderColor,
                  color: cat.completed === cat.total ? ring : ui.textMuted,
                  background: ui.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                }}
              >
                {cat.label} {cat.completed}/{cat.total}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {visibleItems.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="flex items-start gap-3 rounded-xl border px-3.5 py-3 transition hover:brightness-110"
                style={cardMutedStyleFor(ui)}
              >
                <div className="mt-0.5 shrink-0" style={{ color: item.done ? ring : ui.textMuted }}>
                  {item.done ? <CheckCircle2 className="h-4.5 w-4.5 h-[18px] w-[18px]" /> : <Circle className="h-[18px] w-[18px]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold" style={{ color: ui.text }}>
                      {item.label}
                    </p>
                    {item.required && !item.done ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: 'rgba(251, 113, 133, 0.14)', color: '#fb7185' }}
                      >
                        Required
                      </span>
                    ) : null}
                    {item.done ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: ui.accentSoft, color: ui.accent }}
                      >
                        Done
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{
                          background: ui.isDark ? 'rgba(251, 191, 36, 0.14)' : 'rgba(251, 191, 36, 0.18)',
                          color: '#d97706',
                        }}
                      >
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: ui.textMuted }}>
                    {item.detail}
                  </p>
                </div>
                {!item.done ? <ChevronRight className="mt-1 h-4 w-4 shrink-0" style={{ color: ui.textMuted }} /> : null}
              </Link>
            ))}
          </div>

          {health.items.length > visibleItems.length || (showAll && health.pendingCount > 0) ? (
            <button
              type="button"
              className="text-sm font-semibold underline-offset-2 hover:underline"
              style={{ color: ui.accent }}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Show pending only' : 'Show full checklist'}
            </button>
          ) : null}

          {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
        </div>
      </div>
    </FlowCard>
  );
};
