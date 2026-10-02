import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Gauge, Loader2, RefreshCw, Ticket, UserRound } from 'lucide-react';
import { api } from '../api/client';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowAlert, FlowButton, FlowInput, FlowLabel, FlowPage, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { formatApiError } from '../utils/apiError';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
import { cn } from '../utils/cn';
import { purchaseLimitsSummary, type PurchaseLimits } from '../utils/purchaseLimits';

type LimitsResponse = PurchaseLimits & { ok?: boolean };

function toInputValue(n: number | null): string {
  return n != null && n >= 1 ? String(n) : '';
}

function parseLimitInput(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(100, Math.floor(n));
}

export const EventPurchaseLimits: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const accentBtn = accentButtonStyleFor(ui);
  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [perOrder, setPerOrder] = useState('');
  const [perCustomer, setPerCustomer] = useState('');
  const [saved, setSaved] = useState<PurchaseLimits>({
    maxTicketsPerOrder: null,
    maxTicketsPerCustomer: null,
    enabled: false,
  });

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<LimitsResponse>(`/api/events/${eventId}/purchase-limits`);
      const next: PurchaseLimits = {
        maxTicketsPerOrder: res.maxTicketsPerOrder ?? null,
        maxTicketsPerCustomer: res.maxTicketsPerCustomer ?? null,
        enabled: !!(res.maxTicketsPerOrder || res.maxTicketsPerCustomer),
      };
      setSaved(next);
      setPerOrder(toInputValue(next.maxTicketsPerOrder));
      setPerCustomer(toInputValue(next.maxTicketsPerCustomer));
    } catch (e) {
      setErr(formatApiError(e, 'Could not load purchase limits'));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (preset: 'one' | 'two' | 'clear') => {
    if (preset === 'clear') {
      setPerOrder('');
      setPerCustomer('');
      return;
    }
    if (preset === 'one') {
      setPerOrder('1');
      setPerCustomer('1');
      return;
    }
    setPerOrder('2');
    setPerCustomer('2');
  };

  const save = async () => {
    if (!eventId) return;
    const maxTicketsPerOrder = parseLimitInput(perOrder);
    const maxTicketsPerCustomer = parseLimitInput(perCustomer);
    if (perOrder.trim() !== '' && maxTicketsPerOrder == null) {
      setErr('Per-order limit must be a whole number from 1 to 100, or left blank.');
      return;
    }
    if (perCustomer.trim() !== '' && maxTicketsPerCustomer == null) {
      setErr('Per-customer limit must be a whole number from 1 to 100, or left blank.');
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await api.post<LimitsResponse>(`/api/events/${eventId}/purchase-limits`, {
        maxTicketsPerOrder,
        maxTicketsPerCustomer,
      });
      const next: PurchaseLimits = {
        maxTicketsPerOrder: res.maxTicketsPerOrder ?? null,
        maxTicketsPerCustomer: res.maxTicketsPerCustomer ?? null,
        enabled: !!(res.maxTicketsPerOrder || res.maxTicketsPerCustomer),
      };
      setSaved(next);
      setPerOrder(toInputValue(next.maxTicketsPerOrder));
      setPerCustomer(toInputValue(next.maxTicketsPerCustomer));
      setMsg(
        next.enabled
          ? `Saved — ${purchaseLimitsSummary(next)}.`
          : 'Saved — no ticket purchase limits (anyone can buy available inventory).'
      );
    } catch (e) {
      setErr(formatApiError(e, 'Could not save purchase limits'));
    } finally {
      setSaving(false);
    }
  };

  if (!eventId) return null;

  const summary = purchaseLimitsSummary(saved);

  return (
    <OrganizerFlowShell
      title="Purchase limits"
      subtitle="Restrict how many tickets one order or one customer can buy"
      navLinks={navLinks}
      maxWidth="wide"
    >
      <FlowPage className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: ui.textMuted }}>
            Example: set both limits to <strong style={{ color: ui.text }}>1</strong> so each customer can buy only
            one ticket for this event.
          </p>
          <FlowButton variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </FlowButton>
        </div>

        {msg ? <FlowAlert variant="success">{msg}</FlowAlert> : null}
        {err ? <FlowAlert variant="error">{err}</FlowAlert> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: ui.textMuted }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading limits…
          </div>
        ) : (
          <>
            <div className="rounded-2xl border p-5 shadow-sm sm:p-6" style={cardStyle}>
              <div className="flex items-start gap-3">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: ui.accentSoft, color: ui.accent }}
                >
                  <Gauge className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold" style={{ color: ui.text }}>
                    Current policy
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                    {summary ? summary : 'No limits — guests can buy any available inventory.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('one')}
                  className="rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{ ...cardMutedStyle, color: ui.text }}
                >
                  Preset: 1 per customer
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('two')}
                  className="rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{ ...cardMutedStyle, color: ui.text }}
                >
                  Preset: 2 per customer
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('clear')}
                  className="rounded-xl border px-3 py-2 text-xs font-bold"
                  style={{ ...cardMutedStyle, color: ui.textMuted }}
                >
                  Clear limits
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border p-5 shadow-sm" style={cardStyle}>
                <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
                  <Ticket className="h-4 w-4" style={{ color: ui.accent }} />
                  Max tickets per order
                </h3>
                <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                  Caps how many tickets can be in a single checkout cart. Leave blank for no order cap.
                </p>
                <div className="mt-3">
                  <FlowLabel>Limit</FlowLabel>
                  <FlowInput
                    type="number"
                    min={1}
                    max={100}
                    placeholder="No limit"
                    value={perOrder}
                    onChange={(e) => setPerOrder(e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
              </div>

              <div className="rounded-2xl border p-5 shadow-sm" style={cardStyle}>
                <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
                  <UserRound className="h-4 w-4" style={{ color: ui.accent }} />
                  Max tickets per customer
                </h3>
                <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                  Caps lifetime tickets for the same email or phone across paid and pending orders. Leave blank for no
                  customer cap.
                </p>
                <div className="mt-3">
                  <FlowLabel>Limit</FlowLabel>
                  <FlowInput
                    type="number"
                    min={1}
                    max={100}
                    placeholder="No limit"
                    value={perCustomer}
                    onChange={(e) => setPerCustomer(e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border p-4 text-sm" style={cardMutedStyle}>
              <p style={{ color: ui.textMuted }}>
                Limits apply to public checkout (free, PayHere, and bank transfer). Organizer manual registrations and
                VIP invitees are not blocked. Matching uses buyer and ticket-holder email/phone.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="turnout-btn-accent inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                style={accentBtn}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save limits'}
              </button>
            </div>
          </>
        )}
      </FlowPage>
    </OrganizerFlowShell>
  );
};
