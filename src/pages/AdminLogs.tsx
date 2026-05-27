import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowCard, FlowAlert, FlowButton, FlowInput, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';

type LogRow = { id: string; action: string; actorRole?: string; targetType?: string; targetId?: string; createdAt: string };

export const AdminLogs: React.FC = () => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const load = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (action.trim() !== '') params.set('action', action.trim());
      setRows((await api.get<{ logs: LogRow[] }>(`/api/admin/logs?${params.toString()}`)).logs);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load logs');
    }
  };
  useEffect(() => { void load(); }, []);

  return (
    <AdminShell title="Moderation Logs" subtitle="Audit trail for user and admin actions.">
      <FlowCard>
        <div className="mb-3 flex gap-2">
          <FlowInput
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter by action key..."
            className="flex-1"
          />
          <FlowButton onClick={() => void load()}>Filter</FlowButton>
        </div>
        {error && <FlowAlert variant="error">{error}</FlowAlert>}
        <div className="mt-2 space-y-2">
          {rows.map((log) => (
            <div key={log.id} className="rounded-xl border px-3 py-2.5 text-sm" style={cardMutedStyleFor(ui)}>
              <div className="font-semibold" style={{ color: ui.text }}>{log.action}</div>
              <div className="text-xs" style={{ color: ui.textMuted }}>
                {log.actorRole ?? 'system'} · {log.targetType ?? 'n/a'}:{log.targetId ?? '-'} · {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </FlowCard>
    </AdminShell>
  );
};
