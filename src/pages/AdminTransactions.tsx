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
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const ui = APP_FLOW_UI;

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      const res = await api.get<{ transactions: PlatformTransaction[] }>(
        `/api/admin/transactions?${params.toString()}`
      );
      setRows(res.transactions);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateTx = async (
    id: string,
    patch: { isFlagged?: boolean; refundRequested?: boolean; adminNote?: string }
  ) => {
    await api.post(`/api/admin/transactions/${id}`, patch);
    await load();
  };

  const selectStyle = { borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text };

  return (
    <AdminShell title="Transactions" subtitle="Monitor payments, flag suspicious activity, and manage refund requests.">
      <FlowCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-xl border px-3 py-2 text-sm outline-none"
            style={selectStyle}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
          <FlowButton onClick={() => void load()}>Filter</FlowButton>
        </div>
        {error && <FlowAlert variant="error">{error}</FlowAlert>}
        {loading && <div className="text-sm" style={{ color: ui.textMuted }}>Loading transactions…</div>}
        <div className="mt-2 space-y-3">
          {rows.map((t) => (
            <div key={t.id} className="rounded-xl border px-3 py-3" style={cardMutedStyleFor(ui)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold" style={{ color: ui.text }}>
                    {formatLKR(t.amount)} · {t.paymentStatus}
                    {t.isFlagged ? (
                      <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
                        Flagged
                      </span>
                    ) : null}
                    {t.refundRequested ? (
                      <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-400">
                        Refund requested
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                    Event #{t.eventId}
                    {t.payhereReference ? ` · ${t.payhereReference}` : ''} · {new Date(t.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: ui.textSubtle }}>
                    Fee {formatLKR(t.platformFee)} · Organizer {formatLKR(t.organizerAmount)}
                  </div>
                  {t.adminNote ? (
                    <p className="mt-2 text-xs italic" style={{ color: ui.textMuted }}>
                      Note: {t.adminNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <FlowButton
                    variant="secondary"
                    onClick={() => void updateTx(t.id, { isFlagged: !t.isFlagged })}
                  >
                    {t.isFlagged ? 'Unflag' : 'Flag'}
                  </FlowButton>
                  <FlowButton
                    variant="secondary"
                    onClick={() => void updateTx(t.id, { refundRequested: !t.refundRequested })}
                  >
                    {t.refundRequested ? 'Clear refund' : 'Request refund'}
                  </FlowButton>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={noteDraft[t.id] ?? t.adminNote ?? ''}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder="Admin note"
                  className="min-w-[200px] flex-1 rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                  style={selectStyle}
                />
                <FlowButton
                  variant="secondary"
                  onClick={() =>
                    void updateTx(t.id, { adminNote: (noteDraft[t.id] ?? t.adminNote ?? '').trim() })
                  }
                >
                  Save note
                </FlowButton>
              </div>
            </div>
          ))}
        </div>
      </FlowCard>
    </AdminShell>
  );
};
