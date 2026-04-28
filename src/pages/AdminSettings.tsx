import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AdminShell } from '../components/admin/AdminShell';
import { Button } from '../components/ui/Button';

type SettingsMap = Record<string, string>;

export const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setSettings((await api.get<{ settings: SettingsMap }>('/api/admin/settings')).settings);
    } catch (e: any) {
      setError(e?.error || 'Failed to load settings');
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
    } catch (e: any) {
      setError(e?.error || 'Failed to save settings');
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
    } catch (e: any) {
      setError(e?.error || 'Failed to clean demo data');
    }
  };

  return (
    <AdminShell title="System Settings" subtitle="Platform identity, commission, payment and maintenance mode.">
      <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <input value={settings.platform_name ?? ''} onChange={(e) => onField('platform_name', e.target.value)} placeholder="Platform name" className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
        <input value={settings.platform_logo_url ?? ''} onChange={(e) => onField('platform_logo_url', e.target.value)} placeholder="Logo URL" className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
        <input value={settings.commission_pct ?? '10'} onChange={(e) => onField('commission_pct', e.target.value)} placeholder="Commission %" className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
        <input value={settings.payment_merchant_id ?? ''} onChange={(e) => onField('payment_merchant_id', e.target.value)} placeholder="PayHere Merchant ID" className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
        <input value={settings.payment_merchant_secret ?? ''} onChange={(e) => onField('payment_merchant_secret', e.target.value)} placeholder="PayHere Merchant Secret" className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
        <input value={settings.email_from ?? ''} onChange={(e) => onField('email_from', e.target.value)} placeholder="Email From" className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm" />
        <select value={settings.maintenance_mode ?? 'off'} onChange={(e) => onField('maintenance_mode', e.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          <option value="off">Maintenance Off</option>
          <option value="on">Maintenance On</option>
        </select>
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
        <Button variant="secondary" onClick={cleanupDemoData}>Remove Demo Data</Button>
      </div>
    </AdminShell>
  );
};
