import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { OrganizerPayout } from '../types';
import { formatLKR } from '../utils/money';
import { Button } from '../components/ui/Button';

type OrganizerBalance = { organizerId: string; displayName: string; availableBalance: number };

export const AdminPayouts: React.FC = () => {
  const [payouts, setPayouts] = useState<OrganizerPayout[]>([]);
  const [balances, setBalances] = useState<OrganizerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const [p, b] = await Promise.all([
        api.get<{ payouts: OrganizerPayout[] }>('/api/admin/payouts'),
        api.get<{ organizers: OrganizerBalance[] }>('/api/admin/organizers/balances'),
      ]);
      setPayouts(p.payouts);
      setBalances(b.organizers);
    } catch (e: any) {
      setError(e?.error || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const downloadCsv = async () => {
    const payload = await api.get<{ rows: Array<Record<string, string | number>> }>('/api/admin/payouts/export-csv');
    const rows = payload.rows ?? [];
    const headers = ['id', 'organizerId', 'organizerName', 'amount', 'status', 'method', 'reference', 'createdAt', 'completedAt'];
    const escapeCell = (value: string | number) => `"${String(value ?? '').split('"').join('""')}"`;
    const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escapeCell(row[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell title="Payout Control" subtitle="Create, approve, reject payouts and export payout report data.">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">Pending Balances</h2>
          <Button variant="secondary" onClick={downloadCsv}>Export CSV</Button>
        </div>
        {error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="text-sm text-neutral-500">Loading payouts...</div> : null}
        <div className="space-y-2">
          {balances.map((o) => (
            <div key={o.organizerId} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-sm font-medium text-neutral-900">{o.displayName}</div>
              <div className="flex gap-2">
                <span className="text-sm font-semibold text-emerald-700">{formatLKR(o.availableBalance)}</span>
                <Button size="sm" onClick={async () => { await api.post('/api/admin/payouts', { organizerId: o.organizerId, totalAmount: o.availableBalance, notes: 'Auto from control panel' }); await load(); }}>Pay Now</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">Payout History</h2>
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-sm font-medium text-neutral-900">#{p.id} • {formatLKR(p.totalAmount)} • {p.status}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/api/admin/payouts/${p.id}/status`, { status: 'processing', note: 'Processing transfer' }); await load(); }}>Processing</Button>
                <Button size="sm" onClick={async () => { await api.post(`/api/admin/payouts/${p.id}/status`, { status: 'completed', reference: `BANK-${Date.now()}` }); await load(); }}>Complete</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
};
