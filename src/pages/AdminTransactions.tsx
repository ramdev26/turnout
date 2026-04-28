import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { Button } from '../components/ui/Button';
import { PlatformTransaction } from '../types';
import { formatLKR } from '../utils/money';

export const AdminTransactions: React.FC = () => {
  const [rows, setRows] = useState<PlatformTransaction[]>([]);
  const [status, setStatus] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      setRows((await api.get<{ transactions: PlatformTransaction[] }>(`/api/admin/transactions?${params.toString()}`)).transactions);
    } catch (e: any) {
      setError(e?.error || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="Transactions" subtitle="Monitor payments, flag suspicious transactions and add admin notes.">
      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'pending' | 'paid' | 'failed')} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
          <Button onClick={load}>Filter</Button>
        </div>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="text-sm text-neutral-500">Loading transactions...</div> : null}
        {rows.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="text-sm">
              <div className="font-semibold text-neutral-900">TX #{t.id} • {formatLKR(t.amount)}</div>
              <div className="text-xs text-neutral-500">{t.paymentStatus} • flagged: {t.isFlagged ? 'yes' : 'no'}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={async () => { await api.post(`/api/admin/transactions/${t.id}`, { isFlagged: !t.isFlagged, adminNote: t.adminNote ?? 'Reviewed by admin' }); await load(); }}>
                {t.isFlagged ? 'Unflag' : 'Flag'}
              </Button>
              <Button size="sm" onClick={async () => { await api.post(`/api/admin/transactions/${t.id}`, { refundRequested: !t.refundRequested, adminNote: 'Manual correction note' }); await load(); }}>
                Toggle Refund
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
};
