import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowCard, FlowAlert, FlowButton, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';
import { OrganizerPayout } from '../types';
import { formatLKR } from '../utils/money';

type OrganizerBalance = { organizerId: string; displayName: string; availableBalance: number };

export const AdminPayouts: React.FC = () => {
  const [payouts, setPayouts] = useState<OrganizerPayout[]>([]);
  const [balances, setBalances] = useState<OrganizerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const load = async () => {
    setError(null);
    try {
      const [p, b] = await Promise.all([
        api.get<{ payouts: OrganizerPayout[] }>('/api/admin/payouts'),
        api.get<{ organizers: OrganizerBalance[] }>('/api/admin/organizers/balances'),
      ]);
      setPayouts(p.payouts);
      setBalances(b.organizers);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load payouts');
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
      {error && <FlowAlert variant="error">{error}</FlowAlert>}
      {loading && <div className="text-sm" style={{ color: ui.textMuted }}>Loading payouts...</div>}

      <FlowCard>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" style={{ color: ui.text }}>Pending Balances</h2>
          <FlowButton variant="secondary" onClick={() => void downloadCsv()}>Export CSV</FlowButton>
        </div>
        <div className="space-y-2">
          {balances.map((o) => (
            <div key={o.organizerId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5" style={cardMutedStyleFor(ui)}>
              <div className="text-sm font-medium" style={{ color: ui.text }}>{o.displayName}</div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: ui.accent }}>{formatLKR(o.availableBalance)}</span>
                <FlowButton onClick={async () => { await api.post('/api/admin/payouts', { organizerId: o.organizerId, totalAmount: o.availableBalance, notes: 'Auto from control panel' }); await load(); }}>
                  Pay Now
                </FlowButton>
              </div>
            </div>
          ))}
        </div>
      </FlowCard>

      <FlowCard>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: ui.text }}>Payout History</h2>
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5" style={cardMutedStyleFor(ui)}>
              <div className="text-sm font-medium" style={{ color: ui.text }}>#{p.id} · {formatLKR(p.totalAmount)} · {p.status}</div>
              <div className="flex gap-2">
                <FlowButton variant="secondary" onClick={async () => { await api.post(`/api/admin/payouts/${p.id}/status`, { status: 'processing', note: 'Processing transfer' }); await load(); }}>
                  Processing
                </FlowButton>
                <FlowButton onClick={async () => { await api.post(`/api/admin/payouts/${p.id}/status`, { status: 'completed', reference: `BANK-${Date.now()}` }); await load(); }}>
                  Complete
                </FlowButton>
              </div>
            </div>
          ))}
        </div>
      </FlowCard>
    </AdminShell>
  );
};
