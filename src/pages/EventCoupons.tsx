import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
  Copy,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowAlert, FlowButton, FlowInput, FlowLabel, FlowPage, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { TurnoutSelect } from '../components/ui/TurnoutSelect';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { formatApiError } from '../utils/apiError';
import { formatLKRWhole } from '../utils/money';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
import { TURNOUT_BRAND } from '../themes/brandColors';
import { cn } from '../utils/cn';

export type EventCoupon = {
  id: string;
  eventId: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountPercent: number;
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  minOrderAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string | null;
};

type FormState = {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: string;
  maxUses: string;
  minOrderAmount: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  discountType: 'percent',
  discountValue: '10',
  maxUses: '',
  minOrderAmount: '',
  startsAt: '',
  endsAt: '',
  active: true,
});

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string | null {
  const v = local.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function discountLabel(c: EventCoupon): string {
  if (c.discountType === 'fixed') return `${formatLKRWhole(c.discountValue)} off`;
  return `${c.discountPercent}% off`;
}

export const EventCoupons: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const accentBtn = accentButtonStyleFor(ui);
  const solidPanelBg = ui.isDark ? TURNOUT_BRAND.teal900 : '#ffffff';
  const solidMutedBg = ui.isDark ? TURNOUT_BRAND.teal800 : '#f4f4f5';

  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);

  const [coupons, setCoupons] = useState<EventCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EventCoupon | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await api.get<{ coupons: EventCoupon[] }>(`/api/events/${eventId}/coupons`);
      setCoupons(res.coupons || []);
    } catch (e) {
      setErr(formatApiError(e, 'Could not load coupons'));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setEditorOpen(true);
    setErr(null);
  };

  const openEdit = (c: EventCoupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountType === 'fixed' ? String(c.discountValue) : String(c.discountPercent),
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
      startsAt: toLocalInputValue(c.startsAt),
      endsAt: toLocalInputValue(c.endsAt),
      active: c.active,
    });
    setEditorOpen(true);
    setErr(null);
  };

  const saveCoupon = async () => {
    if (!eventId) return;
    const code = form.code.trim().toUpperCase();
    const discountValue = Number(form.discountValue);
    if (!code) {
      setErr('Enter a coupon code.');
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setErr('Enter a valid discount amount.');
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    const payload = {
      code,
      discountType: form.discountType,
      discountPercent: form.discountType === 'percent' ? discountValue : undefined,
      discountValue: form.discountType === 'fixed' ? discountValue : form.discountType === 'percent' ? discountValue : discountValue,
      maxUses: form.maxUses.trim() === '' ? null : Number(form.maxUses),
      minOrderAmount: form.minOrderAmount.trim() === '' ? null : Number(form.minOrderAmount),
      startsAt: fromLocalInputValue(form.startsAt),
      endsAt: fromLocalInputValue(form.endsAt),
      active: form.active,
    };
    try {
      if (editing) {
        await api.post(`/api/events/${eventId}/coupons/${editing.id}`, payload);
        setMsg(`Updated coupon ${code}`);
      } else {
        await api.post(`/api/events/${eventId}/coupons`, payload);
        setMsg(`Created coupon ${code}`);
      }
      setEditorOpen(false);
      await load();
    } catch (e) {
      setErr(formatApiError(e, 'Could not save coupon'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: EventCoupon) => {
    if (!eventId) return;
    setBusyId(c.id);
    setErr(null);
    try {
      await api.post(`/api/events/${eventId}/coupons/${c.id}`, { active: !c.active });
      setMsg(`${c.code} ${c.active ? 'disabled' : 'enabled'}`);
      await load();
    } catch (e) {
      setErr(formatApiError(e, 'Could not update coupon'));
    } finally {
      setBusyId(null);
    }
  };

  const deleteCoupon = async (c: EventCoupon) => {
    if (!eventId) return;
    if (!window.confirm(`Delete coupon ${c.code}? This cannot be undone.`)) return;
    setBusyId(c.id);
    setErr(null);
    try {
      await api.post(`/api/events/${eventId}/coupons/${c.id}/delete`, {});
      setMsg(`Deleted ${c.code}`);
      await load();
    } catch (e) {
      setErr(formatApiError(e, 'Could not delete coupon'));
    } finally {
      setBusyId(null);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setMsg(`Copied ${code}`);
    } catch {
      setErr('Could not copy code');
    }
  };

  if (!eventId) return null;

  return (
    <OrganizerFlowShell
      title="Coupons"
      subtitle="Create discount codes for checkout — percent or fixed amount"
      navLinks={navLinks}
      maxWidth="wide"
    >
      <FlowPage className="max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: ui.textMuted }}>
            Guests can enter a code at checkout. Discounts apply to the order total after ticket pricing.
          </p>
          <div className="flex flex-wrap gap-2">
            <FlowButton variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </FlowButton>
            <FlowButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New coupon
            </FlowButton>
          </div>
        </div>

        {msg ? <FlowAlert variant="success">{msg}</FlowAlert> : null}
        {err ? <FlowAlert variant="error">{err}</FlowAlert> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: ui.textMuted }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading coupons…
          </div>
        ) : coupons.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={cardStyle}>
            <Tag className="mx-auto h-8 w-8" style={{ color: ui.accent }} />
            <h3 className="mt-3 text-base font-bold" style={{ color: ui.text }}>
              No coupons yet
            </h3>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Create your first code — e.g. EARLYBIRD for 15% off.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
              style={accentBtn}
            >
              <Plus className="h-4 w-4" />
              Create coupon
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((c) => {
              const exhausted = c.maxUses != null && c.usedCount >= c.maxUses;
              return (
                <div key={c.id} className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-mono text-lg font-bold tracking-wide" style={{ color: ui.text }}>
                          {c.code}
                        </h3>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            background: c.active && !exhausted ? 'rgba(192,255,114,0.16)' : 'rgba(148,163,184,0.2)',
                            color: c.active && !exhausted ? ui.accent : ui.textMuted,
                          }}
                        >
                          {!c.active ? 'Off' : exhausted ? 'Used up' : 'Active'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                        {discountLabel(c)}
                        {c.minOrderAmount != null ? ` · min order ${formatLKRWhole(c.minOrderAmount)}` : ''}
                        {' · '}
                        {c.usedCount}
                        {c.maxUses != null ? ` / ${c.maxUses}` : ''} used
                      </p>
                      {(c.startsAt || c.endsAt) && (
                        <p className="mt-0.5 text-xs" style={{ color: ui.textSubtle }}>
                          {c.startsAt ? `From ${new Date(c.startsAt).toLocaleString()}` : 'No start'}
                          {' · '}
                          {c.endsAt ? `Until ${new Date(c.endsAt).toLocaleString()}` : 'No end'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyCode(c.code)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"
                        style={{ ...cardMutedStyle, color: ui.text }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => openEdit(c)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold"
                        style={{ ...cardMutedStyle, color: ui.text }}
                      >
                        <Percent className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void toggleActive(c)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"
                        style={{ ...cardMutedStyle, color: ui.text }}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : c.active ? (
                          <ToggleRight className="h-3.5 w-3.5" />
                        ) : (
                          <ToggleLeft className="h-3.5 w-3.5" />
                        )}
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void deleteCoupon(c)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"
                        style={{
                          borderColor: 'rgba(185,28,28,0.35)',
                          color: '#b91c1c',
                          background: ui.isDark ? 'rgba(127,29,29,0.25)' : 'rgba(254,226,226,0.85)',
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FlowPage>

      {editorOpen
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
              <button
                type="button"
                aria-label="Close coupon editor"
                className="absolute inset-0 bg-black/60"
                disabled={saving}
                onClick={() => !saving && setEditorOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="coupon-editor-title"
                className="relative z-10 flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:rounded-2xl"
                style={{ backgroundColor: solidPanelBg, borderColor: ui.borderColor, color: ui.text }}
              >
                <div
                  className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5"
                  style={{ borderColor: ui.borderColor, backgroundColor: solidMutedBg }}
                >
                  <div>
                    <h2 id="coupon-editor-title" className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                      <Tag className="h-5 w-5" style={{ color: ui.accent }} />
                      {editing ? 'Edit coupon' : 'New coupon'}
                    </h2>
                    <p className="mt-0.5 text-xs sm:text-sm" style={{ color: ui.textMuted }}>
                      Share this code with guests — they enter it at checkout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !saving && setEditorOpen(false)}
                    disabled={saving}
                    className="grid h-9 w-9 place-items-center rounded-lg"
                    style={{ color: ui.textMuted }}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                  <div>
                    <FlowLabel>Code</FlowLabel>
                    <FlowInput
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="EARLYBIRD"
                      className={cn(fieldClass, 'font-mono tracking-wide')}
                      style={fieldStyle}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FlowLabel>Discount type</FlowLabel>
                      <TurnoutSelect
                        value={form.discountType}
                        onChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            discountType: v as 'percent' | 'fixed',
                            discountValue: v === 'percent' ? '10' : '500',
                          }))
                        }
                        options={[
                          { value: 'percent', label: 'Percent (%)' },
                          { value: 'fixed', label: 'Fixed (LKR)' },
                        ]}
                        tone={ui.isDark ? 'dark' : 'light'}
                      />
                    </div>
                    <div>
                      <FlowLabel>{form.discountType === 'percent' ? 'Percent off' : 'Amount off (LKR)'}</FlowLabel>
                      <FlowInput
                        type="number"
                        min={0}
                        step={form.discountType === 'percent' ? '1' : '0.01'}
                        value={form.discountValue}
                        onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FlowLabel>Max uses (optional)</FlowLabel>
                      <FlowInput
                        type="number"
                        min={1}
                        value={form.maxUses}
                        onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                        placeholder="Unlimited"
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <FlowLabel>Min order LKR (optional)</FlowLabel>
                      <FlowInput
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.minOrderAmount}
                        onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
                        placeholder="No minimum"
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FlowLabel>Starts (optional)</FlowLabel>
                      <FlowInput
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <FlowLabel>Ends (optional)</FlowLabel>
                      <FlowInput
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium" style={{ color: ui.text }}>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                      className="h-4 w-4 rounded border"
                    />
                    Active (available at checkout)
                  </label>
                </div>

                <div
                  className="flex flex-wrap justify-end gap-2 border-t px-4 py-3 sm:px-5"
                  style={{ borderColor: ui.borderColor, backgroundColor: solidMutedBg }}
                >
                  <FlowButton variant="secondary" disabled={saving} onClick={() => setEditorOpen(false)}>
                    Cancel
                  </FlowButton>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveCoupon()}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                    style={accentBtn}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </OrganizerFlowShell>
  );
};
