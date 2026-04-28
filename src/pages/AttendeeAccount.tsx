import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AttendeeProfile } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { AttendeeShell } from '../components/attendee/AttendeeShell';

export const AttendeeAccount: React.FC = () => {
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [profile, setProfile] = useState<AttendeeProfile>({
    displayName: '',
    email: '',
    avatarUrl: '',
    phone: '',
    bio: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await api.get<{ profile: AttendeeProfile }>('/api/me/profile');
        setProfile({
          displayName: p.profile.displayName || '',
          email: p.profile.email || '',
          avatarUrl: p.profile.avatarUrl || '',
          phone: p.profile.phone || '',
          bio: p.profile.bio || '',
        });
      } catch (e: any) {
        setError(e?.error || 'Failed to load account');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    setProfileMsg(null);
    try {
      const res = await api.post<{ ok: boolean; user: any }>('/api/me/profile', {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || undefined,
        phone: profile.phone || undefined,
        bio: profile.bio || undefined,
      });
      setUser(res.user);
      setProfileMsg('Profile updated');
    } catch (e: any) {
      setError(e?.error || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    setSavingPassword(true);
    setError(null);
    setPasswordMsg(null);
    try {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        throw { error: 'Please fill all password fields' };
      }
      if (passwordForm.newPassword.length < 8) {
        throw { error: 'New password must be at least 8 characters' };
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw { error: 'New password and confirm password do not match' };
      }
      await api.post('/api/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMsg('Password changed successfully');
    } catch (e: any) {
      setError(e?.error || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-neutral-500">Loading account...</div>;
  }

  return (
    <AttendeeShell title="My Account" subtitle="Manage profile details and security settings.">
      <div className="flex flex-col gap-6">

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {profileMsg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{profileMsg}</div>}
      {passwordMsg && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{passwordMsg}</div>}

      <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight">Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">Preview</div>
            <div className="flex items-center gap-3">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.displayName || 'Avatar'} className="h-14 w-14 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-black text-indigo-700">
                  {(profile.displayName || profile.email || 'A').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-neutral-900">{profile.displayName || 'Your name'}</div>
                <div className="text-xs text-neutral-500">{profile.email || 'you@example.com'}</div>
                {profile.phone && <div className="text-xs text-neutral-500">{profile.phone}</div>}
              </div>
            </div>
            {profile.bio && <p className="mt-3 text-xs text-neutral-600">{profile.bio}</p>}
          </div>
          <div className="grid gap-3">
            <input value={profile.displayName} onChange={(e) => setProfile((prev) => ({ ...prev, displayName: e.target.value }))} placeholder="Display name" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm" />
            <input value={profile.email} disabled className="rounded-lg border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm text-neutral-500" />
            <input value={profile.avatarUrl || ''} onChange={(e) => setProfile((prev) => ({ ...prev, avatarUrl: e.target.value }))} placeholder="Avatar image URL (https://...)" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm" />
            <input value={profile.phone || ''} onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone number" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm" />
            <textarea value={profile.bio || ''} onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Short bio / preferences" rows={3} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm" />
            <button type="button" onClick={saveProfile} disabled={savingProfile || !profile.displayName.trim()} className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-2.5 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-50">
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight">Security</h2>
        <p className="mt-1 text-sm text-neutral-500">Change your password anytime.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} placeholder="Current password" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm" />
          <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} placeholder="New password" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm" />
          <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} placeholder="Confirm new password" className="rounded-lg border border-neutral-200 px-4 py-2 text-sm" />
        </div>
        <Button type="button" onClick={changePassword} disabled={savingPassword} variant="secondary" className="mt-3 border-neutral-300 text-neutral-900">
          {savingPassword ? 'Updating...' : 'Change password'}
        </Button>
      </div>
      </div>
    </AttendeeShell>
  );
};
