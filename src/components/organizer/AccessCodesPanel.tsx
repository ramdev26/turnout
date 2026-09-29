import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Download,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldOff,
  Sparkles,
  Upload,
} from 'lucide-react';
import { api } from '../../api/client';
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
import { absoluteAppUrl } from '../../lib/publicAppUrl';
import { TURNOUT_BRAND } from '../../themes/brandColors';

export type EventAccessCode = {
  id: string;
  eventId: string;
  code: string;
  label: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  active: boolean;
  createdAt: string | null;
};

type Props = {
  eventId: string;
  eventSlug?: string | null;
  ui: CreateThemeUI;
  onFeedback?: (msg: string) => void;
  onError?: (msg: string) => void;
};

type UseMode = 'single' | 'limited' | 'unlimited';

const SAMPLE_CODES_CSV = `code,label
VIP-ALPHA,Press guest
VIP-BETA,Staff
FAMILY-01,Family list
`;

function downloadSampleCodesCsv() {
  const blob = new Blob([SAMPLE_CODES_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'access-codes-sample.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCodesCsv(text: string): { rows: { code: string; label?: string }[]; errors: string[] } {
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
  const looksLikeHeader = headerCells.some((c) => c.includes('code') || c === 'access code' || c === 'token');
  const start = looksLikeHeader ? 1 : 0;
  const codeIdx = looksLikeHeader
    ? Math.max(
        0,
        headerCells.findIndex((c) => c === 'code' || c === 'access code' || c === 'token' || c.includes('code'))
      )
    : 0;
  const labelIdx = looksLikeHeader
    ? headerCells.findIndex((c) => c === 'label' || c === 'note' || c === 'name' || c.includes('label'))
    : 1;

  const rows: { code: string; label?: string }[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]);
    const code = (cells[codeIdx] || '').trim().toUpperCase().replace(/\s+/g, '');
    const label = labelIdx >= 0 ? (cells[labelIdx] || '').trim() : '';
    if (!code) continue;
    if (code.length < 4) {
      errors.push(`Row ${i + 1}: code must be at least 4 characters (${code}).`);
      continue;
    }
    if (seen.has(code)) {
      errors.push(`Row ${i + 1}: duplicate code (${code}).`);
      continue;
    }
    seen.add(code);
    rows.push({ code, label: label || undefined });
  }

  return { rows, errors };
}

function fromLocalInputValue(local: string): string | null {
  const v = local.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function usesLabel(c: EventAccessCode): string {
  if (c.maxUses == null) return `${c.usedCount} uses · unlimited`;
  return `${c.usedCount} / ${c.maxUses} uses`;
}

export function AccessCodesPanel({ eventId, eventSlug, ui, onFeedback, onError }: Props) {
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const accentBtn = accentButtonStyleFor(ui);
  const solidPanelBg = ui.isDark ? TURNOUT_BRAND.teal900 : '#ffffff';
  const solidMutedBg = ui.isDark ? TURNOUT_BRAND.teal800 : '#f4f4f5';
  const solidPanelStyle: React.CSSProperties = {
    backgroundColor: solidPanelBg,
    borderColor: ui.borderColor,
    color: ui.text,
  };
  const solidMutedStyle: React.CSSProperties = {
    backgroundColor: solidMutedBg,
    borderColor: ui.borderColor,
  };

  const [privateAccess, setPrivateAccess] = useState(false);
  const [codes, setCodes] = useState<EventAccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [customCode, setCustomCode] = useState('');
  const [label, setLabel] = useState('');
  const [bulkCount, setBulkCount] = useState('10');
  const [useMode, setUseMode] = useState<UseMode>('single');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [pendingUpload, setPendingUpload] = useState<{ code: string; label?: string }[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');

  const landingBase = useMemo(() => {
    if (eventSlug) return absoluteAppUrl(`/e/${eventSlug}`);
    return absoluteAppUrl(`/events/${eventId}`);
  }, [eventId, eventSlug]);

  const resolvedMaxUses = useMemo(() => {
    if (useMode === 'unlimited') return null;
    if (useMode === 'single') return 1;
    const n = Number(maxUses);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  }, [useMode, maxUses]);

  const visibleCodes = useMemo(() => {
    if (showInactive) return codes;
    return codes.filter((c) => c.active);
  }, [codes, showInactive]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ privateAccess: boolean; codes: EventAccessCode[] }>(
        `/api/events/${eventId}/access-codes`
      );
      setPrivateAccess(!!res.privateAccess);
      setCodes(res.codes || []);
    } catch (e) {
      onError?.(formatApiError(e, 'Could not load access codes'));
    } finally {
      setLoading(false);
    }
  }, [eventId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePrivateAccess = async () => {
    setSavingSettings(true);
    try {
      const next = !privateAccess;
      await api.post(`/api/events/${eventId}/access-codes/settings`, { privateAccess: next });
      setPrivateAccess(next);
      onFeedback?.(
        next
          ? 'Private access enabled — guests need a valid access code to open the landing page.'
          : 'Private access disabled — the landing page is public again.'
      );
    } catch (e) {
      onError?.(formatApiError(e, 'Could not update private access'));
    } finally {
      setSavingSettings(false);
    }
  };

  const createOne = async () => {
    const code = customCode.trim().toUpperCase().replace(/\s+/g, '');
    if (code && code.length < 4) {
      onError?.('Custom codes must be at least 4 characters.');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ codes: EventAccessCode[]; created: number }>(
        `/api/events/${eventId}/access-codes`,
        {
          code: code || undefined,
          label: label.trim() || undefined,
          maxUses: resolvedMaxUses,
          expiresAt: fromLocalInputValue(expiresAt),
          count: 1,
        }
      );
      const created = res.codes?.[0];
      onFeedback?.(created ? `Created access code ${created.code}` : 'Access code created');
      setCustomCode('');
      setLabel('');
      await load();
    } catch (e) {
      onError?.(formatApiError(e, 'Could not create access code'));
    } finally {
      setGenerating(false);
    }
  };

  const generateBulk = async () => {
    const count = Math.floor(Number(bulkCount));
    if (!Number.isFinite(count) || count < 1) {
      onError?.('Enter how many codes to generate (1–500).');
      return;
    }
    if (count > 500) {
      onError?.('Generate at most 500 codes at a time.');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ codes: EventAccessCode[]; created: number }>(
        `/api/events/${eventId}/access-codes/bulk`,
        {
          count,
          label: label.trim() || undefined,
          maxUses: resolvedMaxUses,
          expiresAt: fromLocalInputValue(expiresAt),
        }
      );
      const n = res.created || res.codes?.length || 0;
      onFeedback?.(`Generated ${n} access code${n === 1 ? '' : 's'}`);
      await load();
    } catch (e) {
      onError?.(formatApiError(e, 'Could not generate access codes'));
    } finally {
      setGenerating(false);
    }
  };

  const importCodes = async (rows: { code: string; label?: string }[]) => {
    if (rows.length === 0) {
      onError?.('Add at least one code to import.');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{
        codes: EventAccessCode[];
        created: number;
        failed?: { code: string; error: string }[];
      }>(`/api/events/${eventId}/access-codes/bulk`, {
        codes: rows,
        maxUses: resolvedMaxUses,
        expiresAt: fromLocalInputValue(expiresAt),
        label: label.trim() || undefined,
      });
      const created = res.created || 0;
      const failed = res.failed?.length || 0;
      onFeedback?.(
        `Imported ${created} code${created === 1 ? '' : 's'}` + (failed ? ` · ${failed} skipped` : '')
      );
      setPendingUpload([]);
      setParseErrors([]);
      setFileLabel(null);
      setPasteText('');
      await load();
    } catch (e) {
      onError?.(formatApiError(e, 'Could not import access codes'));
    } finally {
      setGenerating(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setFileLabel(file.name);
    try {
      const text = await file.text();
      const { rows, errors } = parseCodesCsv(text);
      setPendingUpload(rows);
      setParseErrors(errors);
      if (rows.length === 0 && errors.length === 0) {
        onError?.('No access codes found in that file.');
      }
    } catch {
      onError?.('Could not read that CSV file.');
    }
  };

  const parsePaste = () => {
    const { rows, errors } = parseCodesCsv(pasteText);
    setPendingUpload(rows);
    setParseErrors(errors);
    setFileLabel(rows.length ? 'Pasted list' : null);
    if (rows.length === 0 && errors.length === 0) {
      onError?.('Paste one code per line, or a CSV with a code column.');
    }
  };

  const revoke = async (c: EventAccessCode) => {
    if (!window.confirm(`Revoke access code ${c.code}? Guests will no longer be able to unlock with it.`)) {
      return;
    }
    setBusyId(c.id);
    try {
      await api.post(`/api/events/${eventId}/access-codes/${c.id}/revoke`, {});
      onFeedback?.(`Revoked ${c.code}`);
      await load();
    } catch (e) {
      onError?.(formatApiError(e, 'Could not revoke code'));
    } finally {
      setBusyId(null);
    }
  };

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onFeedback?.(okMsg);
    } catch {
      onError?.('Could not copy to clipboard');
    }
  };

  const exportCsv = () => {
    const lines = ['code,label,max_uses,used_count,expires_at,active'];
    for (const c of codes) {
      lines.push(
        [
          c.code,
          c.label ? `"${c.label.replace(/"/g, '""')}"` : '',
          c.maxUses == null ? '' : String(c.maxUses),
          String(c.usedCount),
          c.expiresAt || '',
          c.active ? 'yes' : 'no',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-codes-${eventId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onFeedback?.('Downloaded access codes CSV');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: ui.textMuted }}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading access codes…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border p-4 sm:p-5" style={solidMutedStyle}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
              <Lock className="h-4 w-4" style={{ color: ui.accent }} />
              Private landing access
            </p>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              When enabled, guests must enter a valid access code before the event page and checkout open.
              The event is also hidden from public listings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void togglePrivateAccess()}
            disabled={savingSettings}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition',
              privateAccess ? 'turnout-btn-accent' : 'border'
            )}
            style={privateAccess ? accentBtn : { ...cardStyle, color: ui.text }}
          >
            {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {privateAccess ? 'Private · codes required' : 'Public · anyone can open'}
          </button>
        </div>
        {privateAccess && codes.filter((c) => c.active).length === 0 ? (
          <div className="mt-3">
            <FlowAlert variant="error">
              Private access is on, but you have no active codes yet. Generate or import codes below so guests can unlock.
            </FlowAlert>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border p-4 sm:p-5" style={solidPanelStyle}>
          <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
            <Plus className="h-4 w-4" style={{ color: ui.accent }} />
            Create codes
          </h3>
          <div className="mt-4 space-y-3">
            <div>
              <FlowLabel>Custom code (optional)</FlowLabel>
              <FlowInput
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="Leave blank to auto-generate"
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <FlowLabel>Label</FlowLabel>
              <FlowInput
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Press list · Family"
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FlowLabel>Use limit</FlowLabel>
                <TurnoutSelect
                  value={useMode}
                  onChange={(v) => setUseMode(v as UseMode)}
                  options={[
                    { value: 'single', label: 'Single use' },
                    { value: 'limited', label: 'Limited uses' },
                    { value: 'unlimited', label: 'Unlimited' },
                  ]}
                  tone={ui.isDark ? 'dark' : 'light'}
                />
              </div>
              {useMode === 'limited' ? (
                <div>
                  <FlowLabel>Max uses</FlowLabel>
                  <FlowInput
                    type="number"
                    min={1}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
              ) : (
                <div>
                  <FlowLabel>Expires (optional)</FlowLabel>
                  <FlowInput
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </div>
              )}
            </div>
            {useMode === 'limited' ? (
              <div>
                <FlowLabel>Expires (optional)</FlowLabel>
                <FlowInput
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <FlowButton onClick={() => void createOne()} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {customCode.trim() ? 'Add custom code' : 'Generate 1 code'}
              </FlowButton>
            </div>
            <div className="border-t pt-3" style={{ borderColor: ui.borderColor }}>
              <FlowLabel>Bulk generate</FlowLabel>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <FlowInput
                  type="number"
                  min={1}
                  max={500}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(e.target.value)}
                  className={cn(fieldClass, 'w-28')}
                  style={fieldStyle}
                />
                <FlowButton variant="secondary" onClick={() => void generateBulk()} disabled={generating}>
                  <Sparkles className="h-4 w-4" />
                  Generate batch
                </FlowButton>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: ui.textSubtle }}>
                Creates up to 500 unique codes using the use limit and expiry above.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4 sm:p-5" style={solidPanelStyle}>
          <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: ui.text }}>
            <Upload className="h-4 w-4" style={{ color: ui.accent }} />
            Import codes
          </h3>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Upload a CSV or paste one code per line. Optional second column is a label.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ ...cardStyle, color: ui.text }}
            >
              <Upload className="h-4 w-4" />
              {fileLabel || 'Choose CSV'}
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              type="button"
              onClick={downloadSampleCodesCsv}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ ...cardStyle, color: ui.textMuted }}
            >
              <Download className="h-4 w-4" />
              Sample CSV
            </button>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder={'VIP-ALPHA\nVIP-BETA,Press\nFAMILY-01'}
            className={cn(fieldClass, 'mt-3 w-full resize-y font-mono text-sm')}
            style={fieldStyle}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <FlowButton variant="secondary" onClick={parsePaste}>
              Preview paste
            </FlowButton>
            <FlowButton
              onClick={() => void importCodes(pendingUpload)}
              disabled={generating || pendingUpload.length === 0}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import {pendingUpload.length || ''} code{pendingUpload.length === 1 ? '' : 's'}
            </FlowButton>
          </div>
          {parseErrors.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-rose-600">
              {parseErrors.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {parseErrors.length > 6 ? <li>…and {parseErrors.length - 6} more</li> : null}
            </ul>
          ) : null}
          {pendingUpload.length > 0 ? (
            <p className="mt-2 text-xs font-medium" style={{ color: ui.accent }}>
              Ready to import {pendingUpload.length} code{pendingUpload.length === 1 ? '' : 's'}
              {pendingUpload[0] ? ` (e.g. ${pendingUpload[0].code})` : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border p-4 sm:p-5" style={solidPanelStyle}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold" style={{ color: ui.text }}>
              Active codes ({visibleCodes.length}
              {!showInactive && codes.length !== visibleCodes.length ? ` of ${codes.length}` : ''})
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: ui.textMuted }}>
              Share a code or a deep link — guests unlock once, then stay unlocked on this device.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowInactive((v) => !v)}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{ ...cardStyle, color: ui.textMuted }}
            >
              {showInactive ? 'Hide revoked' : 'Show revoked'}
            </button>
            <FlowButton variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </FlowButton>
            <FlowButton variant="secondary" onClick={exportCsv} disabled={codes.length === 0}>
              <Download className="h-4 w-4" />
              Export
            </FlowButton>
          </div>
        </div>

        {visibleCodes.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-10 text-center" style={cardMutedStyle}>
            <KeyRound className="mx-auto h-7 w-7" style={{ color: ui.accent }} />
            <p className="mt-2 text-sm font-semibold" style={{ color: ui.text }}>
              No access codes yet
            </p>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Generate a batch or import a CSV to invite private guests.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleCodes.map((c) => {
              const link = `${landingBase}?code=${encodeURIComponent(c.code)}`;
              const expired =
                !!c.expiresAt && !Number.isNaN(Date.parse(c.expiresAt)) && Date.parse(c.expiresAt) < Date.now();
              const exhausted = c.maxUses != null && c.usedCount >= c.maxUses;
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  style={cardMutedStyle}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-sm font-bold tracking-wide" style={{ color: ui.text }}>
                        {c.code}
                      </code>
                      {!c.active ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600 bg-rose-500/10">
                          Revoked
                        </span>
                      ) : expired ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 bg-amber-500/10">
                          Expired
                        </span>
                      ) : exhausted ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 bg-amber-500/10">
                          Used up
                        </span>
                      ) : (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#059669' }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                      {c.label ? `${c.label} · ` : ''}
                      {usesLabel(c)}
                      {c.expiresAt
                        ? ` · expires ${new Date(c.expiresAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(c.code, `Copied ${c.code}`)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      style={{ ...cardStyle, color: ui.textMuted }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Code
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(link, 'Copied unlock link')}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      style={{ ...cardStyle, color: ui.textMuted }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Link
                    </button>
                    {c.active ? (
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => void revoke(c)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold text-rose-600"
                        style={cardStyle}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ShieldOff className="h-3.5 w-3.5" />
                        )}
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
