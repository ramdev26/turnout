import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';

type LogRow = { id: string; action: string; actorRole?: string; targetType?: string; targetId?: string; createdAt: string };

export const AdminLogs: React.FC = () => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (action.trim() !== '') params.set('action', action.trim());
      setRows((await api.get<{ logs: LogRow[] }>(`/api/admin/logs?${params.toString()}`)).logs);
    } catch (e: any) {
      setError(e?.error || 'Failed to load logs');
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="Moderation Logs" subtitle="Audit trail for user and admin actions.">
      <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex gap-2">
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter by action key..." className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
          <button onClick={() => void load()} className="rounded-xl bg-[#00E676] px-4 py-2 text-sm font-semibold text-[#062013]">Filter</button>
        </div>
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {rows.map((log) => (
          <div key={log.id} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
            <div className="font-semibold text-neutral-900">{log.action}</div>
            <div className="text-xs text-neutral-500">{log.actorRole ?? 'system'} • {log.targetType ?? 'n/a'}:{log.targetId ?? '-'} • {new Date(log.createdAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
};
