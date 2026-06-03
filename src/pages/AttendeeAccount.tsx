import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { parseAuthPayload } from '../api/authResponse';
import { AttendeeProfile } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { AttendeeShell } from '../components/attendee/AttendeeShell';
import { FlowCard, FlowAlert, FlowButton, FlowInput, FlowTextarea, FlowLabel, APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor } from '../themes/flowUi';

export const AttendeeAccount: React.FC = () => {
  const { setUser } = useAuthStore();
  const ui = APP_FLOW_UI;
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
      } catch (e: unknown) {
        const err = e as { error?: string };
        setError(err?.error || 'Failed to load account');
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
      const res = parseAuthPayload(
        await api.post<unknown>('/api/me/profile', {
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl || undefined,
          phone: profile.phone || undefined,
          bio: profile.bio || undefined,
        })
      );
      setUser(res.user);
      setProfileMsg('Profile updated');
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to save profile');
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
    } catch (e: unknown) {
      const err = e as { error?: string };
      setError(err?.error || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <AttendeeShell title="My Account" subtitle="Loading…">
        <div className="flex h-48 items-center justify-center text-sm" style={{ color: ui.textMuted }}>
          Loading account...
        </div>
      </AttendeeShell>
    );
  }

  return (
    <AttendeeShell title="My Account" subtitle="Manage profile details and security settings.">
      <div className="flex flex-col gap-6">
        {error && <FlowAlert variant="error">{error}</FlowAlert>}
        {profileMsg && <FlowAlert variant="success">{profileMsg}</FlowAlert>}
        {passwordMsg && <FlowAlert variant="success">{passwordMsg}</FlowAlert>}

        <FlowCard>
          <h2 className="text-xl font-semibold" style={{ color: ui.text }}>
            Profile
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4" style={cardMutedStyleFor(ui)}>
              <div className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                Preview
              </div>
              <div className="flex items-center gap-3">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName || 'Avatar'}
                    className="h-14 w-14 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ backgroundColor: ui.accent }}
                  >
                    {(profile.displayName || profile.email || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold" style={{ color: ui.text }}>
                    {profile.displayName || 'Your name'}
                  </div>
                  <div className="text-xs" style={{ color: ui.textMuted }}>
                    {profile.email || 'you@example.com'}
                  </div>
                  {profile.phone && (
                    <div className="text-xs" style={{ color: ui.textMuted }}>
                      {profile.phone}
                    </div>
                  )}
                </div>
              </div>
              {profile.bio && (
                <p className="mt-3 text-xs" style={{ color: ui.textMuted }}>
                  {profile.bio}
                </p>
              )}
            </div>
            <div className="grid gap-3 content-start">
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Display name</FlowLabel>
                <FlowInput
                  value={profile.displayName}
                  onChange={(e) => setProfile((prev) => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Display name"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Email (read-only)</FlowLabel>
                <FlowInput value={profile.email} disabled />
              </label>
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Avatar URL</FlowLabel>
                <FlowInput
                  value={profile.avatarUrl || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Phone</FlowLabel>
                <FlowInput
                  value={profile.phone || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone number"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Bio</FlowLabel>
                <FlowTextarea
                  value={profile.bio || ''}
                  onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Short bio / preferences"
                  rows={3}
                />
              </label>
              <FlowButton
                type="button"
                onClick={saveProfile}
                disabled={savingProfile || !profile.displayName.trim()}
                className="w-full"
              >
                {savingProfile ? 'Saving…' : 'Save profile'}
              </FlowButton>
            </div>
          </div>
        </FlowCard>

        <FlowCard>
          <h2 className="text-xl font-semibold" style={{ color: ui.text }}>
            Security
          </h2>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Change your password anytime.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <FlowLabel>Current password</FlowLabel>
              <FlowInput
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Current password"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <FlowLabel>New password</FlowLabel>
              <FlowInput
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="New password"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <FlowLabel>Confirm new password</FlowLabel>
              <FlowInput
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm"
              />
            </label>
          </div>
          <FlowButton
            type="button"
            onClick={changePassword}
            disabled={savingPassword}
            variant="secondary"
            className="mt-4"
          >
            {savingPassword ? 'Updating...' : 'Change password'}
          </FlowButton>
        </FlowCard>
      </div>
    </AttendeeShell>
  );
};
