import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { FlowCard, FlowAlert, FlowButton, FlowInput, FlowLabel, APP_FLOW_UI } from '../components/flow/FlowPrimitives';

type SettingsMap = Record<string, string>;

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ui = APP_FLOW_UI;

  const load = async () => {
    setError(null);
    try {
      setSettings((await api.get<{ settings: SettingsMap }>('/api/admin/settings')).settings);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to load settings');
    }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.post('/api/admin/settings', settings);
      setMessage('Settings saved successfully.');
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const onField = (k: string, v: string) => setSettings((prev) => ({ ...prev, [k]: v }));

  const cleanupDemoData = async () => {
    setMessage(null);
    setError(null);
    try {
      const res = await api.post<{ deletedUsers: number; deletedEvents: number }>('/api/admin/system/cleanup-demo-data', {});
      setMessage(`Demo cleanup complete. Users removed: ${res.deletedUsers}, events removed: ${res.deletedEvents}.`);
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to clean demo data');
    }
  };

  const selectStyle = { borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text };

  return (
    <AdminShell title="System Settings" subtitle="Platform identity, commission, payment and maintenance mode.">
      {error && <FlowAlert variant="error">{error}</FlowAlert>}
      {message && <FlowAlert variant="success">{message}</FlowAlert>}

      <FlowCard>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { key: 'platform_name', label: 'Platform name', placeholder: 'Turnout' },
            { key: 'platform_logo_url', label: 'Logo URL', placeholder: 'https://...' },
            { key: 'commission_pct', label: 'Commission %', placeholder: '10' },
            { key: 'payment_merchant_id', label: 'PayHere Merchant ID', placeholder: '' },
            { key: 'payment_merchant_secret', label: 'PayHere Merchant Secret', placeholder: '' },
            { key: 'email_from', label: 'Email From', placeholder: 'admin@bigturnout.co' },
          ].map(({ key, label, placeholder }) => (
            <label key={key} className="flex flex-col gap-1.5">
              <FlowLabel>{label}</FlowLabel>
              <FlowInput
                value={settings[key] ?? ''}
                onChange={(e) => onField(key, e.target.value)}
                placeholder={placeholder}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1.5">
            <FlowLabel>PayHere mode</FlowLabel>
            <select
              value={settings.payment_sandbox ?? 'on'}
              onChange={(e) => onField('payment_sandbox', e.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={selectStyle}
            >
              <option value="on">Sandbox (testing)</option>
              <option value="off">Live (production)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <FlowLabel>Maintenance mode</FlowLabel>
            <select
              value={settings.maintenance_mode ?? 'off'}
              onChange={(e) => onField('maintenance_mode', e.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={selectStyle}
            >
              <option value="off">Off</option>
              <option value="on">On</option>
            </select>
          </label>
        </div>

        <div
          className="mt-5 rounded-xl border p-4 text-sm leading-relaxed"
          style={{ borderColor: ui.borderColor, background: ui.cardMutedBg ?? ui.fieldBg, color: ui.textMuted }}
        >
          <p className="font-semibold" style={{ color: ui.text }}>PayHere setup</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>In your PayHere account, open <strong>Integrations</strong> and copy your <strong>Merchant ID</strong>.</li>
            <li>Click <strong>Add Domain/App</strong>, enter your site domain, and once approved copy the <strong>Merchant Secret</strong> shown for that domain.</li>
            <li>Paste both above, choose <strong>Sandbox</strong> for testing or <strong>Live</strong> for production, and Save.</li>
          </ol>
          <p className="mt-2">
            The return, cancel, and notify URLs are handled automatically on your current domain
            (<span className="font-mono">/api/payhere/notify</span>). No code changes needed.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <FlowButton onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </FlowButton>
          <FlowButton variant="secondary" onClick={() => void cleanupDemoData()}>
            Remove Demo Data
          </FlowButton>
        </div>
      </FlowCard>
    </AdminShell>
  );
};
