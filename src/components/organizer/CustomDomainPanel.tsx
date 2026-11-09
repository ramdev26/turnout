import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { CheckCircle2, ChevronDown, Copy, Globe, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { CreateThemeUI } from '../../themes/eventThemes';
import { accentButtonStyleFor, cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';

type DnsRecord = { type: string; name: string; value: string; ttl: number };

type DomainState = {
  customDomain: string | null;
  customDomainPath?: string | null;
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
  const [pathInput, setPathInput] = useState('');
  const [state, setState] = useState<DomainState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const applyDomainInput = (raw: string) => {
    const cleaned = raw.trim().replace(/^https?:\/\//i, '');
    const combined = cleaned.match(/^([^/?#]+)\/([a-z0-9][a-z0-9-]{0,30}[a-z0-9]?)$/i);
    if (combined) {
      setDomainInput(combined[1]);
      setPathInput(combined[2].toLowerCase());
      return;
    }
    setDomainInput(raw);
  };

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
      setPathInput(res.customDomainPath || '');
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
    let domain = domainInput.trim().replace(/^https?:\/\//i, '');
    let path = pathInput.trim().replace(/^\/+/, '');
    // Accept paste like tickets.takemybass.com/cc in the domain box.
    const combined = domain.match(/^([^/?#]+)\/([a-z0-9][a-z0-9-]{0,30}[a-z0-9]?)$/i);
    if (combined) {
      domain = combined[1];
      if (!path) path = combined[2].toLowerCase();
      setDomainInput(domain);
      setPathInput(path);
    }
    if (!domain) {
      setError('Enter a domain like tickets.takemybass.com');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.post<{
        customDomain: string;
        customDomainPath?: string | null;
        publicUrl: string;
        dns: DomainState['dns'];
        vercel: DomainState['vercel'];
      }>(`/api/events/${eventId}/domain`, {
        domain,
        path: path || null,
      });
      setDomainInput(res.customDomain);
      setPathInput(res.customDomainPath || '');
      setMessage(
        res.customDomainPath
          ? `Domain saved. Public page: https://${res.customDomain}/${res.customDomainPath}`
          : 'Domain saved. Add the DNS records below at your DNS provider.'
      );
      onUpdated?.(res.customDomain);
      await load();
    } catch (e: any) {
      const code = e?.error || '';
      if (code === 'domain_taken') {
        setError(
          e?.message ||
            'This domain is already used by another event. Put only the domain above (tickets.takemybass.com) and set the path below to cc (or tmb).'
        );
      } else {
        setError(e?.message || e?.error || 'Could not save domain');
      }
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
      const res = await api.post<{
        dnsDetected: boolean;
        configured: boolean;
        platformVerified?: boolean;
        vercel: DomainState['vercel'];
      }>(
        `/api/events/${eventId}/domain/verify`
      );
      if (res.configured) {
        setMessage('Domain is active. Your custom URL should now open this event.');
      } else if (res.dnsDetected) {
        setMessage('DNS records are detected, but activation is still pending. Wait a few minutes and check again.');
      } else {
        setMessage('DNS not detected yet. Double-check records at your DNS provider, then try again.');
      }
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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Domain
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={domainInput}
                  onChange={(e) => applyDomainInput(e.target.value)}
                  placeholder="tickets.takemybass.com"
                  className={fieldClass}
                  style={fieldStyle}
                />
                <button
                  type="button"
                  onClick={saveDomain}
                  disabled={saving}
                  className="turnout-btn-accent rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:brightness-105 disabled:opacity-50"
                  style={accentButtonStyleFor(ui)}
                >
                  {saving ? 'Saving…' : active ? 'Update' : 'Connect'}
                </button>
              </div>

              <label className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                Path (required to share this domain)
              </label>
              <div
                className="flex items-center gap-0 overflow-hidden rounded-xl border"
                style={{ ...fieldStyle, borderColor: ui.borderColor }}
              >
                <span
                  className="shrink-0 border-r px-3 py-2.5 font-mono text-xs sm:text-sm"
                  style={{ color: ui.textMuted, borderColor: ui.borderColor, background: ui.cardMutedBg }}
                >
                  {(domainInput.trim().split('/')[0] || 'tickets.takemybass.com').replace(/^https?:\/\//i, '')}/
                </span>
                <input
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="cc"
                  maxLength={32}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 font-mono text-sm outline-none"
                  style={{ color: ui.text }}
                />
              </div>
              <p className="mt-1.5 text-xs" style={{ color: ui.textSubtle }}>
                For Club Ctrl type <span className="font-mono font-semibold">cc</span> here. Live URL becomes{' '}
                <span className="font-mono">
                  {(domainInput.trim().split('/')[0] || 'tickets.takemybass.com').replace(/^https?:\/\//i, '')}/
                  {pathInput.trim() || 'cc'}
                </span>
                .
              </p>

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
                    DNS setup
                  </p>
                  <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                    {state.dns.note ||
                      'Add these BigTurnout DNS records where your domain is managed (Cloudflare, GoDaddy, Namecheap, etc.).'}
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
                Default event link: <span className="font-mono">{state?.defaultUrl}</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
