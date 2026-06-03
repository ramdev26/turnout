import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { CheckCircle2, ChevronDown, Copy, Globe, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';

type DnsRecord = { type: string; name: string; value: string; ttl: number };

type DomainState = {
  customDomain: string | null;
  publicUrl: string | null;
  defaultUrl: string;
  dns: { hostname: string; isApex: boolean; records: DnsRecord[]; note: string } | null;
  vercel: { ok?: boolean; verified?: boolean; skipped?: boolean; message?: string };
  cnameTarget: string;
  apexIp: string;
};

type Props = {
  eventId: string;
  ui: CreateThemeUI;
  onUpdated?: (domain: string | null) => void;
};

export const CustomDomainPanel: React.FC<Props> = ({ eventId, ui, onUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [state, setState] = useState<DomainState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DomainState>(`/api/events/${eventId}/domain`);
      setState(res);
      setDomainInput(res.customDomain || '');
    } catch (e: any) {
      setError(e?.message || e?.error || 'Could not load domain settings');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint(`${label} copied`);
      window.setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint('Copy failed');
    }
  };

  const saveDomain = async () => {
    const domain = domainInput.trim();
    if (!domain) {
      setError('Enter a domain like events.yourbrand.com');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.post<{
        customDomain: string;
        publicUrl: string;
        dns: DomainState['dns'];
        vercel: DomainState['vercel'];
      }>(`/api/events/${eventId}/domain`, { domain });
      setMessage(res.vercel?.message || 'Domain saved. Add the DNS records below at your registrar.');
      onUpdated?.(res.customDomain);
      await load();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Could not save domain');
    } finally {
      setSaving(false);
    }
  };

  const removeDomain = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.delete<{ ok: boolean }>(`/api/events/${eventId}/domain`);
      onUpdated?.(null);
      setDomainInput('');
      setMessage('Custom domain removed.');
      await load();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Could not remove domain');
    } finally {
      setSaving(false);
    }
  };

  const verifyDomain = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await api.post<{ dnsDetected: boolean; configured: boolean; vercel: DomainState['vercel'] }>(
        `/api/events/${eventId}/domain/verify`
      );
      setMessage(
        res.configured
          ? 'DNS looks good. Your custom domain should be live within a few minutes.'
          : 'DNS not detected yet. Double-check records at your registrar, then try again.'
      );
      await load();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const active = !!state?.customDomain;

  return (
    <div className="mb-5 rounded-2xl border p-5 transition-[background,border-color] duration-700" style={cardStyle}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: ui.accentSoft, color: ui.accent }}
          >
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: ui.text }}>
              Custom domain
            </h2>
            <p className="text-sm" style={{ color: ui.textMuted }}>
              Use your own URL for this event page
            </p>
          </div>
        </div>
        <ChevronDown className={cn('h-5 w-5 transition', expanded && 'rotate-180')} style={{ color: ui.textMuted }} />
      </button>

      {expanded && (
        <div className="mt-5">
          {loading ? (
            <div className="space-y-2">
              <div className="h-10 animate-pulse rounded-xl" style={{ background: ui.cardMutedBg }} />
              <div className="h-24 animate-pulse rounded-xl" style={{ background: ui.cardMutedBg }} />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="events.yourbrand.com"
                  className={fieldClass}
                  style={fieldStyle}
                />
                <button
                  type="button"
                  onClick={saveDomain}
                  disabled={saving}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                  style={{ backgroundColor: ui.accent }}
                >
                  {saving ? 'Saving…' : active ? 'Update' : 'Connect'}
                </button>
              </div>

              {active && state?.publicUrl && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm" style={{ color: ui.text }}>
                  <span style={{ color: ui.textMuted }}>Live URL:</span>
                  <a href={state.publicUrl} target="_blank" rel="noreferrer" className="font-mono hover:underline" style={{ color: ui.accent }}>
                    {state.publicUrl}
                  </a>
                  {state.vercel?.verified && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: ui.accentSoft, color: ui.accent }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  )}
                </div>
              )}

              {state?.dns?.records?.length ? (
                <div className="mt-5 rounded-xl border p-4" style={cardMutedStyle}>
                  <p className="text-sm font-semibold" style={{ color: ui.text }}>
                    DNS records
                  </p>
                  <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                    {state.dns.note}
                  </p>
                  <div className="mt-3 space-y-2">
                    {state.dns.records.map((rec) => (
                      <div
                        key={`${rec.type}-${rec.name}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                        style={cardStyle}
                      >
                        <div className="font-mono" style={{ color: ui.text }}>
                          <span className="font-bold">{rec.type}</span> {rec.name} → {rec.value}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(rec.value, rec.type)}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-semibold"
                          style={{ ...cardStyle, color: ui.textMuted }}
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={verifyDomain}
                  disabled={verifying || !active}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  style={{ ...cardStyle, color: ui.text }}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', verifying && 'animate-spin')} />
                  Check DNS
                </button>
                {active && (
                  <button
                    type="button"
                    onClick={removeDomain}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>

              {message && (
                <p className="mt-3 text-sm font-medium" style={{ color: ui.accent }}>
                  {message}
                </p>
              )}
              {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
              {copyHint && (
                <p className="mt-2 text-xs" style={{ color: ui.textSubtle }}>
                  {copyHint}
                </p>
              )}
              <p className="mt-3 text-xs" style={{ color: ui.textSubtle }}>
                Fallback: <span className="font-mono">{state?.defaultUrl}</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
