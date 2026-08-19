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
  const [payhereStatus, setPayhereStatus] = useState<string | null>(null);
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

  const onField = (k: string, v: string) => setSettings((prev) => ({ ...prev, [k]: v }));

  const checkPayhere = async () => {
    setPayhereStatus(null);
    try {
      const res = await api.get<{ accepted?: boolean; message?: string }>('/api/admin/payhere/check');
      setPayhereStatus(res.accepted ? 'PayHere credentials accepted.' : res.message || 'PayHere check failed.');
    } catch (e: unknown) {
      const err = e as { error?: string; message?: string };
      setPayhereStatus(err?.message || err?.error || 'PayHere check failed.');
    }
  };

  const selectStyle = { borderColor: ui.borderColor, background: ui.fieldBg, color: ui.text };

  return (
    <AdminShell title="System Settings" subtitle="Platform identity, commission, and maintenance mode.">
      {error && <FlowAlert variant="error">{error}</FlowAlert>}
      {message && <FlowAlert variant="success">{message}</FlowAlert>}

      <FlowCard>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { key: 'platform_name', label: 'Platform name', placeholder: 'Turnout' },
            { key: 'platform_logo_url', label: 'Logo URL', placeholder: 'https://...' },
            { key: 'commission_pct', label: 'Commission %', placeholder: '10' },
            { key: 'email_from', label: 'Email From', placeholder: 'admin@bigturnout.co' },
            { key: 'payhere_merchant_id', label: 'PayHere Merchant ID', placeholder: 'e.g. 257283' },
            { key: 'payhere_app_base_url', label: 'PayHere App Base URL', placeholder: 'https://app.bigturnout.co' },
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
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <FlowLabel>PayHere Merchant Secret</FlowLabel>
            <FlowInput
              type="password"
              value={settings.payhere_merchant_secret ?? ''}
              onChange={(e) => onField('payhere_merchant_secret', e.target.value)}
              placeholder={
                settings.payhere_secret_configured === 'true'
                  ? 'Configured (enter a new value only to rotate)'
                  : 'Paste Merchant Secret'
              }
            />
            {settings.payhere_secret_configured === 'true' ? (
              <p className="text-xs" style={{ color: ui.textMuted }}>
                A merchant secret is already configured. Leave blank to keep current value.
              </p>
            ) : null}
          </label>
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

      <FlowCard>
        <h2 className="mb-3 text-base font-semibold" style={{ color: ui.text }}>
          PayHere integration
        </h2>
        <p className="mb-3 text-sm" style={{ color: ui.textMuted }}>
          Verify platform PayHere credentials are accepted before going live.
        </p>
        <FlowButton variant="secondary" onClick={() => void checkPayhere()}>
          Test PayHere credentials
        </FlowButton>
        {payhereStatus ? (
          <p className="mt-3 text-sm" style={{ color: ui.textMuted }}>
            {payhereStatus}
          </p>
        ) : null}
      </FlowCard>
    </AdminShell>
  );
};
