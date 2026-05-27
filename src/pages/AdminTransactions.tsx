import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowCard, FlowAlert, FlowButton, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';
import { PlatformTransaction } from '../types';
import { formatLKR } from '../utils/money';

export const AdminTransactions: React.FC = () => {
  const [rows, setRows] = useState<PlatformTransaction[]>([]);
  const [status, setStatus] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      setRows((await api.get<{ transactions: PlatformTransaction[] }>(`/api/admin/transactions?${params.toString()}`)).transactions);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="Transactions" subtitle="Monitor payments, flag suspicious transactions and add admin notes.">
      <FlowCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
          <FlowButton onClick={() => void load()}>Filter</FlowButton>
        </div>
        {error && <FlowAlert variant="error">{error}</FlowAlert>}
        {loading && <div className="text-sm" style={{ color: ui.textMuted }}>Loading transactions...</div>}
        <div className="mt-2 space-y-2">
          {rows.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm" style={cardMutedStyleFor(ui)}>
              <div>
                <div className="font-semibold" style={{ color: ui.text }}>{formatLKR(t.amount)} · {t.status}</div>
                <div className="text-xs" style={{ color: ui.textMuted }}>{t.paymentMethod ?? 'unknown'} · {new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.status !== 'failed' && (
                  <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/transactions/${t.id}/flag`, {}); await load(); }}>
                    Flag
                  </FlowButton>
                )}
              </div>
            </div>
          ))}
        </div>
      </FlowCard>
    </AdminShell>
  );
};
