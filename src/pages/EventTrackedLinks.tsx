import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
  Copy,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowAlert, FlowButton, FlowInput, FlowLabel, FlowPage, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { eventWorkspaceNav } from '../utils/organizerNav';
import { formatApiError } from '../utils/apiError';
import { formatLKRWhole } from '../utils/money';
import { accentButtonStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../themes/flowUi';
import { TURNOUT_BRAND } from '../themes/brandColors';
import { absoluteAppUrl } from '../lib/publicAppUrl';
import { cn } from '../utils/cn';
import type { Event } from '../types';

export type EventTrackedLink = {
  id: string;
  eventId: string;
  code: string;
  label: string;
  clickCount: number;
  orderCount: number;
  ticketCount: number;
  revenue: number;
  active: boolean;
  createdAt: string | null;
};

type FormState = {
  code: string;
  label: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  code: '',
  label: '',
  active: true,
});

function slugifyCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 64);
}

export const EventTrackedLinks: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const ui = APP_FLOW_UI;
  const cardStyle = cardStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const accentBtn = accentButtonStyleFor(ui);
  const solidPanelBg = ui.isDark ? TURNOUT_BRAND.teal900 : '#ffffff';

  const navLinks = useMemo(() => (eventId ? eventWorkspaceNav(eventId) : []), [eventId]);

  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [links, setLinks] = useState<EventTrackedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EventTrackedLink | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const landingBase = useMemo(() => {
    if (eventSlug) return absoluteAppUrl(`/e/${eventSlug}`);
    if (eventId) return absoluteAppUrl(`/events/${eventId}`);
    return '';
  }, [eventId, eventSlug]);

  const trackedUrl = useCallback(
    (code: string) => {
      if (!landingBase) return '';
      const sep = landingBase.includes('?') ? '&' : '?';
      return `${landingBase}${sep}ref=${encodeURIComponent(code)}`;
    },
    [landingBase]
  );

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setErr(null);
    try {
      const [linksRes, eventRes] = await Promise.all([
        api.get<{ links: EventTrackedLink[] }>(`/api/events/${eventId}/tracked-links`),
        api.get<{ event: Event }>(`/api/events/${eventId}`),
      ]);
      setLinks(linksRes.links || []);
      setEventSlug(eventRes.event?.slug || null);
    } catch (e) {
      setErr(formatApiError(e, 'Could not load tracked links'));
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

  const openEdit = (link: EventTrackedLink) => {
    setEditing(link);
    setForm({
      code: link.code,
      label: link.label,
      active: link.active,
    });
    setEditorOpen(true);
    setErr(null);
  };

  const saveLink = async () => {
    if (!eventId) return;
    const code = slugifyCode(form.code);
    const label = form.label.trim();
    if (!code) {
      setErr('Enter a link code (e.g. DJ_NOVA or META_ADS).');
      return;
    }
    if (!label) {
      setErr('Add a label so you know which artist or ad this is.');
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    const payload = { code, label, active: form.active };
    try {
      if (editing) {
        await api.post(`/api/events/${eventId}/tracked-links/${editing.id}`, payload);
        setMsg(`Updated ${code}`);
      } else {
        await api.post(`/api/events/${eventId}/tracked-links`, payload);
        setMsg(`Created tracked link ${code}`);
      }
      setEditorOpen(false);
      await load();
    } catch (e) {
      setErr(formatApiError(e, 'Could not save tracked link'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (link: EventTrackedLink) => {
    if (!eventId) return;
    setBusyId(link.id);
    setErr(null);
    try {
      await api.post(`/api/events/${eventId}/tracked-links/${link.id}`, { active: !link.active });
      setMsg(`${link.code} ${link.active ? 'disabled' : 'enabled'}`);
      await load();
    } catch (e) {
      setErr(formatApiError(e, 'Could not update tracked link'));
    } finally {
      setBusyId(null);
    }
  };

  const deleteLink = async (link: EventTrackedLink) => {
    if (!eventId) return;
    if (!window.confirm(`Delete tracked link ${link.code}? Past sales already stored on orders stay attributed.`)) {
      return;
    }
    setBusyId(link.id);
    setErr(null);
    try {
      await api.post(`/api/events/${eventId}/tracked-links/${link.id}/delete`, {});
      setMsg(`Deleted ${link.code}`);
      await load();
    } catch (e) {
      setErr(formatApiError(e, 'Could not delete tracked link'));
    } finally {
      setBusyId(null);
    }
  };

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(okMsg);
    } catch {
      setErr('Could not copy');
    }
  };

  if (!eventId) return null;

  const totals = links.reduce(
    (acc, l) => {
      acc.orders += l.orderCount;
      acc.tickets += l.ticketCount;
      acc.revenue += l.revenue;
      acc.clicks += l.clickCount;
      return acc;
    },
    { orders: 0, tickets: 0, revenue: 0, clicks: 0 }
  );

  return (
    <OrganizerFlowShell
      title="Tracked links"
      subtitle="One link per artist or ad — see clicks and paid sales per link"
      navLinks={navLinks}
      maxWidth="wide"
    >
      <FlowPage className="max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm" style={{ color: ui.textMuted }}>
            Share <span className="font-mono">?ref=CODE</span> links. Guests who buy after opening a link are attributed
            to that code (first touch for the session). No discount — attribution only.
          </p>
          <div className="flex flex-wrap gap-2">
            <FlowButton variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </FlowButton>
            <FlowButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New link
            </FlowButton>
          </div>
        </div>

        {msg ? <FlowAlert variant="success">{msg}</FlowAlert> : null}
        {err ? <FlowAlert variant="error">{err}</FlowAlert> : null}

        {!loading && links.length > 0 ? (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ color: ui.text }}
          >
            {[
              { label: 'Clicks', value: String(totals.clicks) },
              { label: 'Paid orders', value: String(totals.orders) },
              { label: 'Tickets', value: String(totals.tickets) },
              { label: 'Revenue', value: formatLKRWhole(totals.revenue) },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border px-4 py-3" style={cardStyle}>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                  {stat.label}
                </p>
                <p className="mt-1 text-lg font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: ui.textMuted }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tracked links…
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={cardStyle}>
            <Link2 className="mx-auto h-8 w-8" style={{ color: ui.accent }} />
            <h3 className="mt-3 text-base font-bold" style={{ color: ui.text }}>
              No tracked links yet
            </h3>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Create one per artist or ad campaign — e.g. DJ_NOVA or IG_STORY.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
              style={accentBtn}
            >
              <Plus className="h-4 w-4" />
              Create link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => {
              const url = trackedUrl(link.code);
              return (
                <div key={link.id} className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-mono text-lg font-bold tracking-wide" style={{ color: ui.text }}>
                          {link.code}
                        </h3>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            background: link.active ? 'rgba(192,255,114,0.16)' : 'rgba(148,163,184,0.2)',
                            color: link.active ? ui.accent : ui.textMuted,
                          }}
                        >
                          {link.active ? 'Active' : 'Off'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold" style={{ color: ui.text }}>
                        {link.label}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                        {link.clickCount} clicks · {link.orderCount} paid orders · {link.ticketCount} tickets ·{' '}
                        {formatLKRWhole(link.revenue)}
                      </p>
                      {url ? (
                        <p className="mt-2 break-all font-mono text-xs" style={{ color: ui.textSubtle }}>
                          {url}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <FlowButton
                        variant="secondary"
                        onClick={() => void copyText(url, `Copied link for ${link.code}`)}
                        disabled={!url}
                      >
                        <Copy className="h-4 w-4" />
                        Copy link
                      </FlowButton>
                      <FlowButton variant="secondary" onClick={() => openEdit(link)}>
                        Edit
                      </FlowButton>
                      <FlowButton
                        variant="secondary"
                        onClick={() => void toggleActive(link)}
                        disabled={busyId === link.id}
                      >
                        {link.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {link.active ? 'Disable' : 'Enable'}
                      </FlowButton>
                      <FlowButton
                        variant="secondary"
                        onClick={() => void deleteLink(link)}
                        disabled={busyId === link.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </FlowButton>
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
            <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
              <div
                className="w-full max-w-md rounded-2xl border p-5 shadow-xl"
                style={{ backgroundColor: solidPanelBg, borderColor: ui.borderColor, color: ui.text }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">{editing ? 'Edit tracked link' : 'New tracked link'}</h2>
                    <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                      Label is for you; code goes in the share URL.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    className="rounded-lg p-1.5"
                    style={{ color: ui.textMuted }}
                    onClick={() => setEditorOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <FlowLabel>Label</FlowLabel>
                    <FlowInput
                      className={fieldClass}
                      style={fieldStyle}
                      value={form.label}
                      placeholder="DJ Nova · Instagram story"
                      onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <FlowLabel>Code</FlowLabel>
                    <FlowInput
                      className={fieldClass}
                      style={fieldStyle}
                      value={form.code}
                      placeholder="DJ_NOVA"
                      onChange={(e) => setForm((f) => ({ ...f, code: slugifyCode(e.target.value) }))}
                    />
                    {form.code && landingBase ? (
                      <p className="mt-1.5 break-all font-mono text-[11px]" style={{ color: ui.textSubtle }}>
                        {trackedUrl(form.code)}
                      </p>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-sm" style={{ color: ui.text }}>
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Active
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <FlowButton variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
                    Cancel
                  </FlowButton>
                  <FlowButton onClick={() => void saveLink()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {editing ? 'Save' : 'Create'}
                  </FlowButton>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </OrganizerFlowShell>
  );
};
