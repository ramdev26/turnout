import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import type { Ticket } from '../../types';
import type { CreateThemeUI } from '../../themes/eventThemes';
import {
  accentButtonStyleFor,
  cardMutedStyleFor,
  cardStyleFor,
  fieldClassFor,
  fieldStyleFor,
} from '../../themes/flowUi';
import { FlowAlert, FlowButton, FlowInput, FlowLabel } from '../flow/FlowPrimitives';
import { TurnoutSelect } from '../ui/TurnoutSelect';
import { formatApiError } from '../../utils/apiError';
import { cn } from '../../utils/cn';

export type VipInvitee = {
  id: string;
  orderId: string;
  ticketId: string;
  ticketName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  qrToken: string;
  checkedInAt?: string | null;
  createdAt: string;
};

type BulkRow = {
  fullName: string;
  email: string;
  phone?: string;
};

type BulkResultRow = {
  fullName: string;
  email: string;
  ok: boolean;
  error?: string;
  attendeeId?: string;
  emailSent?: boolean;
};

type Props = {
  eventId: string;
  ui: CreateThemeUI;
  onFeedback?: (msg: string) => void;
  onError?: (msg: string) => void;
};

function parseInviteCsv(text: string): { rows: BulkRow[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], errors: ['File is empty.'] };

  const split = (line: string) => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const headerCells = split(lines[0]).map((c) => c.toLowerCase());
  const looksLikeHeader =
    headerCells.some((c) => c.includes('name')) && headerCells.some((c) => c.includes('mail'));

  const start = looksLikeHeader ? 1 : 0;
  const nameIdx = looksLikeHeader
    ? Math.max(
        0,
        headerCells.findIndex((c) => c === 'name' || c === 'full name' || c === 'fullname' || c.includes('name'))
      )
    : 0;
  const emailIdx = looksLikeHeader
    ? Math.max(1, headerCells.findIndex((c) => c === 'email' || c === 'e-mail' || c.includes('mail')))
    : 1;
  const phoneIdx = looksLikeHeader
    ? headerCells.findIndex((c) => c === 'phone' || c === 'mobile' || c.includes('phone') || c.includes('mobile'))
    : 2;

  const rows: BulkRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]);
    const fullName = (cells[nameIdx] || '').trim();
    const email = (cells[emailIdx] || '').trim().toLowerCase();
    const phone = phoneIdx >= 0 ? (cells[phoneIdx] || '').trim() : '';
    if (!fullName && !email) continue;
    if (!fullName || !email) {
      errors.push(`Row ${i + 1}: name and email are required.`);
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${i + 1}: invalid email (${email}).`);
      continue;
    }
    if (seen.has(email)) {
      errors.push(`Row ${i + 1}: duplicate email (${email}).`);
      continue;
    }
    seen.add(email);
    rows.push({ fullName, email, phone: phone || undefined });
  }

  return { rows, errors };
}

export function InviteesPanel({ eventId, ui, onFeedback, onError }: Props) {
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const accentBtn = accentButtonStyleFor(ui);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketId, setTicketId] = useState('');
  const [invitees, setInvitees] = useState<VipInvitee[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const [pendingRows, setPendingRows] = useState<BulkRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [lastResults, setLastResults] = useState<BulkResultRow[] | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);

  const ticketOptions = useMemo(
    () =>
      tickets.map((t) => ({
        value: t.id,
        label: `${t.name} · ${Math.max(0, t.quantity - t.sold)} left`,
      })),
    [tickets]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, inviteesRes] = await Promise.all([
        api.get<{ tickets: Ticket[] }>(`/api/events/${eventId}/tickets`),
        api.get<{ invitees: VipInvitee[] }>(`/api/events/${eventId}/invitees`),
      ]);
      const list = ticketsRes.tickets || [];
      setTickets(list);
      setInvitees(inviteesRes.invitees || []);
      setTicketId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        const available = list.find((t) => t.quantity - t.sold > 0) || list[0];
        return available?.id || '';
      });
    } catch (e) {
      onError?.(formatApiError(e, 'Could not load invitees'));
    } finally {
      setLoading(false);
    }
  }, [eventId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileLabel(file.name);
    setLastResults(null);
    try {
      const text = await file.text();
      const { rows, errors } = parseInviteCsv(text);
      setPendingRows(rows);
      setParseErrors(errors);
      if (rows.length === 0 && errors.length === 0) {
        onError?.('No invitee rows found in that file.');
      }
    } catch {
      onError?.('Could not read that CSV file.');
    }
  };

  const addSingleToQueue = () => {
    const name = fullName.trim();
    const em = email.trim().toLowerCase();
    if (!name || !em) {
      onError?.('Name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      onError?.('Enter a valid email address.');
      return;
    }
    if (pendingRows.some((r) => r.email === em)) {
      onError?.('That email is already in the queue.');
      return;
    }
    setPendingRows((prev) => [...prev, { fullName: name, email: em, phone: phone.trim() || undefined }]);
    setFullName('');
    setEmail('');
    setPhone('');
    setLastResults(null);
  };

  const issuePasses = async () => {
    if (!ticketId) {
      onError?.('Select a ticket type for VIP passes.');
      return;
    }
    if (pendingRows.length === 0) {
      onError?.('Add at least one invitee or upload a CSV.');
      return;
    }
    setSending(true);
    setLastResults(null);
    try {
      const res = await api.post<{
        created: number;
        failed: number;
        emailed: number;
        results: BulkResultRow[];
      }>(`/api/events/${eventId}/invitees/bulk`, {
        ticketId,
        sendEmail,
        invitees: pendingRows,
      });
      setLastResults(res.results || []);
      const created = res.created || 0;
      const emailed = res.emailed || 0;
      const failed = res.failed || 0;
      if (created > 0) {
        onFeedback?.(
          `Issued ${created} VIP pass${created === 1 ? '' : 'es'}` +
            (sendEmail ? ` · ${emailed} email${emailed === 1 ? '' : 's'} sent` : '') +
            (failed ? ` · ${failed} failed` : '')
        );
        setPendingRows([]);
        setParseErrors([]);
        setFileLabel(null);
        await load();
      } else {
        onError?.(failed ? `Could not issue passes (${failed} failed).` : 'No passes were created.');
      }
    } catch (e) {
      onError?.(formatApiError(e, 'Could not issue VIP passes'));
    } finally {
      setSending(false);
    }
  };

  const resend = async (invitee: VipInvitee) => {
    setResendingId(invitee.id);
    try {
      await api.post(`/api/events/${eventId}/invitees/${invitee.id}/resend`, {});
      onFeedback?.(`VIP pass re-sent to ${invitee.email}`);
    } catch (e) {
      onError?.(formatApiError(e, 'Could not resend VIP pass'));
    } finally {
      setResendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: ui.textMuted }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading invitees…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border p-4 sm:p-5" style={cardMutedStyle}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
              <Sparkles className="h-4 w-4" style={{ color: ui.accent }} />
              VIP pass generator
            </h3>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: ui.textMuted }}>
              Bulk-upload guests, generate complimentary check-in QR passes, and email a branded VIP card with event
              details.
            </p>
          </div>
          <FlowButton variant="secondary" onClick={() => void load()} className="shrink-0">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </FlowButton>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <FlowLabel>Pass ticket type</FlowLabel>
            <TurnoutSelect
              value={ticketId}
              onChange={setTicketId}
              options={ticketOptions}
              placeholder={tickets.length ? 'Select ticket' : 'No tickets yet'}
              disabled={!tickets.length}
              tone={ui.isDark ? 'dark' : 'light'}
            />
            <p className="mt-1 text-xs" style={{ color: ui.textSubtle }}>
              Uses a complimentary seat from this ticket type.
            </p>
          </div>
          <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm font-medium" style={{ color: ui.text }}>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            Email VIP card with check-in QR after generating
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
          <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
            <UserPlus className="h-4 w-4" />
            Add one invitee
          </h4>
          <div className="mt-3 space-y-3">
            <div>
              <FlowLabel>Full name</FlowLabel>
              <FlowInput
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Guest name"
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <FlowLabel>Email</FlowLabel>
              <FlowInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@email.com"
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <FlowLabel>Phone (optional)</FlowLabel>
              <FlowInput
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+94…"
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <FlowButton variant="secondary" onClick={addSingleToQueue} className="w-full">
              Add to queue
            </FlowButton>
          </div>
        </div>

        <div className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
          <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
            <Upload className="h-4 w-4" />
            Bulk CSV upload
          </h4>
          <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
            Columns: <span className="font-mono">name, email, phone</span> (phone optional). Header row supported.
          </p>
          <label
            className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition hover:opacity-90"
            style={{ ...cardMutedStyle, color: ui.textMuted }}
          >
            <Upload className="h-6 w-6" style={{ color: ui.accent }} />
            <span className="text-sm font-semibold" style={{ color: ui.text }}>
              {fileLabel || 'Choose CSV file'}
            </span>
            <span className="text-xs">or click to browse</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0] || null)}
            />
          </label>
          {parseErrors.length > 0 ? (
            <div className="mt-3 max-h-28 overflow-y-auto rounded-lg border p-2 text-xs" style={cardMutedStyle}>
              {parseErrors.slice(0, 8).map((err) => (
                <p key={err} style={{ color: '#b45309' }}>
                  {err}
                </p>
              ))}
              {parseErrors.length > 8 ? (
                <p style={{ color: ui.textMuted }}>…and {parseErrors.length - 8} more</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
              <Users className="h-4 w-4" />
              Queue · {pendingRows.length} guest{pendingRows.length === 1 ? '' : 's'}
            </h4>
            <p className="mt-0.5 text-xs" style={{ color: ui.textMuted }}>
              Review the list, then generate QR passes{sendEmail ? ' and send VIP cards' : ''}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingRows.length > 0 ? (
              <FlowButton
                variant="secondary"
                onClick={() => {
                  setPendingRows([]);
                  setParseErrors([]);
                  setFileLabel(null);
                }}
                disabled={sending}
              >
                Clear
              </FlowButton>
            ) : null}
            <button
              type="button"
              disabled={sending || pendingRows.length === 0 || !ticketId}
              onClick={() => void issuePasses()}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
              style={accentBtn}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Issuing…' : `Generate${sendEmail ? ' & send' : ''} VIP passes`}
            </button>
          </div>
        </div>

        {pendingRows.length > 0 ? (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border" style={cardMutedStyle}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ color: ui.textSubtle }}>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Phone</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((row) => (
                  <tr key={row.email} className="border-t" style={{ borderColor: ui.borderColor, color: ui.text }}>
                    <td className="px-3 py-2 font-medium">{row.fullName}</td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2" style={{ color: ui.textMuted }}>
                      {row.phone || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold"
                        style={{ color: ui.textMuted }}
                        onClick={() => setPendingRows((prev) => prev.filter((r) => r.email !== row.email))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
            Queue is empty. Add guests manually or upload a CSV.
          </p>
        )}

        {lastResults ? (
          <div className="mt-3 space-y-1.5">
            {lastResults.map((r) => (
              <div
                key={`${r.email}-${r.ok ? 'ok' : 'fail'}`}
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
                style={cardMutedStyle}
              >
                {r.ok ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                )}
                <div>
                  <span className="font-semibold" style={{ color: ui.text }}>
                    {r.fullName}
                  </span>{' '}
                  <span style={{ color: ui.textMuted }}>({r.email})</span>
                  <div style={{ color: r.ok ? ui.textMuted : '#b91c1c' }}>
                    {r.ok ? (r.emailSent ? 'Pass created · email sent' : 'Pass created') : r.error || 'Failed'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border p-4 sm:p-5" style={cardStyle}>
        <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
          <Mail className="h-4 w-4" />
          Issued VIP invitees · {invitees.length}
        </h4>
        {invitees.length === 0 ? (
          <div className="mt-3">
            <FlowAlert variant="info">No VIP invitees yet. Generate passes above to see them here.</FlowAlert>
          </div>
        ) : (
          <div className="mt-3 divide-y rounded-xl border" style={{ ...cardMutedStyle, borderColor: ui.borderColor }}>
            {invitees.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold" style={{ color: ui.text }}>
                    {inv.fullName}
                  </p>
                  <p className="truncate text-xs" style={{ color: ui.textMuted }}>
                    {inv.email}
                    {inv.ticketName ? ` · ${inv.ticketName}` : ''}
                    {inv.checkedInAt ? ' · Checked in' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={resendingId === inv.id}
                  onClick={() => void resend(inv)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50'
                  )}
                  style={{ ...cardStyle, color: ui.text }}
                >
                  {resendingId === inv.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Resend card
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
