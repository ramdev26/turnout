import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { CheckCircle2, Copy, Globe, RefreshCw, Trash2 } from 'lucide-react';

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
  onUpdated?: (domain: string | null) => void;
};

export const CustomDomainPanel: React.FC<Props> = ({ eventId, onUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [state, setState] = useState<DomainState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

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
      if (res.configured) {
        setMessage('DNS looks good. Your custom domain should be live within a few minutes.');
      } else {
        setMessage('DNS not detected yet. Double-check records at your registrar, then try again.');
      }
      await load();
    } catch (e: any) {
      setError(e?.message || e?.error || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="h-6 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="mt-4 h-10 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  const active = !!state?.customDomain;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-neutral-900">Custom domain</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Point your own domain (e.g. events.yourbrand.com) to this event page. DNS + Vercel required.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="events.yourbrand.com"
          className="flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={saveDomain}
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : active ? 'Update domain' : 'Connect domain'}
        </button>
      </div>

      {active && state?.publicUrl && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-neutral-700">Live URL:</span>
          <a href={state.publicUrl} target="_blank" rel="noreferrer" className="font-mono text-indigo-600 hover:underline">
            {state.publicUrl}
          </a>
          {state.vercel?.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified
            </span>
          )}
        </div>
      )}

      {state?.dns?.records?.length ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-semibold text-neutral-800">DNS records to add</p>
          <p className="mt-1 text-xs text-neutral-500">{state.dns.note}</p>
          <div className="mt-3 space-y-2">
            {state.dns.records.map((rec) => (
              <div
                key={`${rec.type}-${rec.name}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs"
              >
                <div className="font-mono text-neutral-700">
                  <span className="font-bold text-neutral-900">{rec.type}</span> {rec.name} → {rec.value}
                </div>
                <button
                  type="button"
                  onClick={() => copyText(rec.value, rec.type)}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 font-semibold text-neutral-600 hover:bg-neutral-50"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            CNAME target: <span className="font-mono">{state.cnameTarget}</span>
            {state.dns.isApex ? (
              <>
                {' '}
                · Apex A record: <span className="font-mono">{state.apexIp}</span>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={verifyDomain}
          disabled={verifying || !active}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
          Check DNS / status
        </button>
        {active && (
          <button
            type="button"
            onClick={removeDomain}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove domain
          </button>
        )}
      </div>

      {message && <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      {copyHint && <p className="mt-2 text-xs text-neutral-500">{copyHint}</p>}

      <p className="mt-4 text-xs text-neutral-400">
        Fallback URL: <span className="font-mono">{state?.defaultUrl}</span>. Custom domains require DNS propagation (up to 48h) and
        adding the domain in Vercel (automatic when API token is configured).
      </p>
    </div>
  );
};
