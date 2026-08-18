import React, { useEffect, useState } from 'react';
import { Building2, CreditCard, FileText, Loader2, Mail, Trash2, UploadCloud, UserPlus, Users } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { api, toApiUrl } from '../api/client';
import {
  OrganizerProfile,
  OrganizerTeamInvite,
  OrganizerTeamMember,
  OrganizerTeamRole,
  OrganizerWorkspace,
} from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { OrganizerFlowShell } from '../components/organizer/OrganizerFlowShell';
import { FlowAlert, FlowButton, FlowCard, FlowInput, FlowLabel, FlowPage } from '../components/flow/FlowPrimitives';
import { organizerMainNav } from '../utils/organizerNav';
import { APP_FLOW_UI } from '../components/flow/FlowPrimitives';
import { cardMutedStyleFor, fieldClassFor, fieldStyleFor, accentButtonStyleFor } from '../themes/flowUi';
import { OrganizerLogoUpload } from '../components/ui/OrganizerLogoUpload';
import { OrganizerPaymentSettingsPanel } from '../components/organizer/OrganizerPaymentSettings';
import { EventPolicyEditorModal } from '../components/organizer/EventPolicyEditorModal';
import { TurnoutSelect } from '../components/ui/TurnoutSelect';
import { DEFAULT_ORGANIZER_TERMS_HTML, resolveOrganizerTermsHtml } from '../utils/organizerTerms';

const ROLE_LABELS: Record<OrganizerTeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

function normalizeLogoUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('/api/')) return url;
  return toApiUrl(url);
}

export const OrganizerAccount: React.FC = () => {
  const { setUser } = useAuthStore();
  const { hash } = useLocation();
  const ui = APP_FLOW_UI;
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [uploadingBrDoc, setUploadingBrDoc] = useState(false);
  const [uploadingBankStatementDoc, setUploadingBankStatementDoc] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [termsHtml, setTermsHtml] = useState(DEFAULT_ORGANIZER_TERMS_HTML);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);

  const [workspace, setWorkspace] = useState<OrganizerWorkspace | null>(null);
  const [profile, setProfile] = useState<OrganizerProfile>({
    displayName: '',
    email: '',
    organizationName: '',
    logoUrl: '',
    website: '',
    phone: '',
    businessAddress: '',
    businessRegistrationNo: '',
    businessRegistrationDocUrl: '',
    businessRegistrationDocUploaded: false,
    bankStatementDocUrl: '',
    bankStatementDocUploaded: false,
  });
  const [members, setMembers] = useState<OrganizerTeamMember[]>([]);
  const [invites, setInvites] = useState<OrganizerTeamInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizerTeamRole>('editor');

  const loadTeam = async () => {
    const res = await api.get<{ members: OrganizerTeamMember[]; invites: OrganizerTeamInvite[]; workspace: OrganizerWorkspace }>(
      '/api/organizer/team'
    );
    setMembers(res.members);
    setInvites(res.invites);
    setWorkspace(res.workspace);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ workspace: OrganizerWorkspace; profile: OrganizerProfile }>('/api/me/organizer-workspace');
        setWorkspace(res.workspace);
        setProfile({
          displayName: res.profile.displayName || '',
          email: res.profile.email || '',
          organizationName: res.profile.organizationName || res.profile.displayName || '',
          logoUrl: res.profile.logoUrl || '',
          website: res.profile.website || '',
          phone: res.profile.phone || '',
          businessAddress: res.profile.businessAddress || '',
          businessRegistrationNo: res.profile.businessRegistrationNo || '',
          businessRegistrationDocUrl: res.profile.businessRegistrationDocUrl || '',
          businessRegistrationDocUploaded: !!res.profile.businessRegistrationDocUploaded,
          bankStatementDocUrl: res.profile.bankStatementDocUrl || '',
          bankStatementDocUploaded: !!res.profile.bankStatementDocUploaded,
          gatewayReviewStatus: res.profile.gatewayReviewStatus || 'none',
          gatewayReviewNote: res.profile.gatewayReviewNote || null,
          termsHtml: res.profile.termsHtml || null,
        });
        setTermsHtml(resolveOrganizerTermsHtml(res.profile.termsHtml));
        if (res.workspace.canManageTeam) {
          await loadTeam();
        }
      } catch (e: unknown) {
        const err = e as { message?: string; error?: string };
        setError(err?.message || err?.error || 'Failed to load organization settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hash || loading) return;
    const id = hash.replace(/^#/, '');
    const node = document.getElementById(id);
    if (!node) return;
    const raf = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [hash, loading]);

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(toApiUrl('/api/uploads/organizer-logo'), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.logoUrl) {
        throw new Error(data.message || 'Logo upload failed');
      }
      setProfile((p) => ({ ...p, logoUrl: normalizeLogoUrl(data.logoUrl) }));
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadOrganizerDocument = async (kind: 'br' | 'bank_statement', file: File) => {
    const setLoading = kind === 'br' ? setUploadingBrDoc : setUploadingBankStatementDoc;
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(toApiUrl(`/api/uploads/organizer-document?kind=${encodeURIComponent(kind)}`), {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.documentUrl) {
        throw new Error(data.message || 'Document upload failed');
      }
      if (kind === 'br') {
        setProfile((p) => ({
          ...p,
          businessRegistrationDocUrl: String(data.documentUrl),
          businessRegistrationDocUploaded: true,
          gatewayReviewStatus: data.gatewayReviewStatus || p.gatewayReviewStatus,
        }));
        setFeedback('Business registration document uploaded.');
      } else {
        setProfile((p) => ({
          ...p,
          bankStatementDocUrl: String(data.documentUrl),
          bankStatementDocUploaded: true,
          gatewayReviewStatus: data.gatewayReviewStatus || p.gatewayReviewStatus,
        }));
        setFeedback('Latest bank statement uploaded.');
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || 'Document upload failed');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await api.post<{ ok: boolean; profile: OrganizerProfile; user: Parameters<typeof setUser>[0] }>(
        '/api/me/organizer-profile',
        {
          displayName: profile.displayName.trim(),
          organizationName: profile.organizationName.trim(),
          logoUrl: profile.logoUrl || undefined,
          website: profile.website?.trim() || undefined,
          phone: profile.phone?.trim() || undefined,
          businessAddress: profile.businessAddress?.trim() || undefined,
          businessRegistrationNo: profile.businessRegistrationNo?.trim() || undefined,
        }
      );
      setUser(res.user);
      setProfile((p) => ({ ...p, ...res.profile }));
      setFeedback('Organization profile saved.');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveTerms = async (html: string) => {
    if (!workspace?.isOwner) return;
    setSavingTerms(true);
    setError(null);
    try {
      const next = resolveOrganizerTermsHtml(html);
      const res = await api.post<{ ok: boolean; profile: OrganizerProfile; user: Parameters<typeof setUser>[0] }>(
        '/api/me/organizer-profile',
        {
          displayName: profile.displayName.trim(),
          organizationName: profile.organizationName.trim(),
          logoUrl: profile.logoUrl || undefined,
          website: profile.website?.trim() || undefined,
          phone: profile.phone?.trim() || undefined,
          businessAddress: profile.businessAddress?.trim() || undefined,
          businessRegistrationNo: profile.businessRegistrationNo?.trim() || undefined,
          termsHtml: next,
        }
      );
      setUser(res.user);
      setProfile((p) => ({ ...p, ...res.profile }));
      setTermsHtml(resolveOrganizerTermsHtml(res.profile.termsHtml));
      setTermsModalOpen(false);
      setFeedback('Terms & Conditions saved.');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to save Terms & Conditions');
    } finally {
      setSavingTerms(false);
    }
  };

  const removeLogo = async () => {
    if (!workspace?.isOwner) return;
    setRemovingLogo(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await api.post<{ ok: boolean; profile: OrganizerProfile; user: Parameters<typeof setUser>[0] }>(
        '/api/me/organizer-profile',
        {
          displayName: profile.displayName.trim(),
          organizationName: profile.organizationName.trim(),
          logoUrl: '',
          website: profile.website?.trim() || undefined,
          phone: profile.phone?.trim() || undefined,
          businessAddress: profile.businessAddress?.trim() || undefined,
          businessRegistrationNo: profile.businessRegistrationNo?.trim() || undefined,
        }
      );
      setUser(res.user);
      setProfile((p) => ({ ...p, ...res.profile, logoUrl: '' }));
      setFeedback('Organization logo removed.');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to remove logo');
    } finally {
      setRemovingLogo(false);
    }
  };

  const sendInvite = async () => {
    setInviting(true);
    setError(null);
    setFeedback(null);
    try {
      await api.post('/api/organizer/team/invite', {
        email: inviteEmail.trim(),
        role: inviteRole === 'owner' ? 'editor' : inviteRole,
      });
      setInviteEmail('');
      setFeedback('Invitation sent.');
      await loadTeam();
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberUserId: string) => {
    setError(null);
    try {
      await api.delete(`/api/organizer/team/members/${memberUserId}`);
      await loadTeam();
      setFeedback('Team member removed.');
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to remove member');
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      await api.delete(`/api/organizer/team/invites/${inviteId}`);
      await loadTeam();
    } catch (e: unknown) {
      const err = e as { message?: string; error?: string };
      setError(err?.message || err?.error || 'Failed to revoke invite');
    }
  };

  if (loading) {
    return (
      <OrganizerFlowShell title="Organization" subtitle="Loading…" navLinks={organizerMainNav}>
        <div className="flex h-48 items-center justify-center text-sm" style={{ color: ui.textMuted }}>
          Loading…
        </div>
      </OrganizerFlowShell>
    );
  }

  return (
    <OrganizerFlowShell title="Organization" subtitle="Brand and team access for your workspace." navLinks={organizerMainNav}>
      <FlowPage>
        {error ? <FlowAlert variant="error">{error}</FlowAlert> : null}
        {feedback ? <FlowAlert variant="success">{feedback}</FlowAlert> : null}

        <section id="org-profile">
        <FlowCard>
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={{ background: ui.accentSoft, color: ui.accent }}
            >
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
                Organization profile
              </h2>
              <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                Your logo and organization name appear on public event pages and tickets.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)] lg:items-start">
            <OrganizerLogoUpload
              previewUrl={profile.logoUrl ? normalizeLogoUrl(profile.logoUrl) : undefined}
              disabled={uploadingLogo}
              removing={removingLogo}
              canEdit={!!workspace?.isOwner}
              ui={ui}
              onFileSelect={uploadLogo}
              onRemove={() => void removeLogo()}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <FlowLabel>Your name</FlowLabel>
                <FlowInput
                  value={profile.displayName}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  disabled={!workspace?.isOwner}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <FlowLabel>Organization name</FlowLabel>
                <FlowInput
                  value={profile.organizationName}
                  onChange={(e) => setProfile((p) => ({ ...p, organizationName: e.target.value }))}
                  disabled={!workspace?.isOwner}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Phone</FlowLabel>
                <FlowInput
                  value={profile.phone || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  disabled={!workspace?.isOwner}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Website</FlowLabel>
                <FlowInput
                  value={profile.website || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                  placeholder="https://"
                  disabled={!workspace?.isOwner}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <FlowLabel>Account email</FlowLabel>
                <FlowInput value={profile.email} disabled className="opacity-70" />
              </label>
            </div>
          </div>

          <div className="mt-8 border-t pt-6" style={{ borderColor: ui.borderColor }}>
            <h3 className="text-base font-semibold" style={{ color: ui.text }}>
              Business documents for Turnout Pay
            </h3>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Upload your business registration and a recent bank statement. Turnout reviews these before unlocking
              paid events on our gateway.
            </p>
            {profile.gatewayReviewStatus === 'pending' ? (
              <FlowAlert variant="info">
                Documents submitted. Turnout Pay stays locked until an admin approves them.
              </FlowAlert>
            ) : null}
            {profile.gatewayReviewStatus === 'approved' ? (
              <FlowAlert variant="success">Turnout Pay documents are approved.</FlowAlert>
            ) : null}
            {profile.gatewayReviewStatus === 'rejected' ? (
              <FlowAlert variant="error">
                {profile.gatewayReviewNote
                  ? `Not approved: ${profile.gatewayReviewNote}`
                  : 'Not approved yet. Upload updated documents to resubmit.'}
              </FlowAlert>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <FlowLabel>Business address</FlowLabel>
                <textarea
                  value={profile.businessAddress || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, businessAddress: e.target.value }))}
                  rows={3}
                  placeholder="Street, city, postal code"
                  className={fieldClass}
                  style={fieldStyle}
                  disabled={!workspace?.isOwner}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <FlowLabel>Business registration no. (optional)</FlowLabel>
                <FlowInput
                  value={profile.businessRegistrationNo || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, businessRegistrationNo: e.target.value }))}
                  placeholder="Company / BR number"
                  disabled={!workspace?.isOwner}
                />
              </label>

              <div className="rounded-2xl border border-dashed p-4" style={cardMutedStyle}>
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                    style={{ background: ui.accentSoft, color: ui.accent }}
                  >
                    <UploadCloud className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: ui.text }}>
                      Business Registration (BR)
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: ui.textMuted }}>
                      PDF, JPG, PNG, or WEBP · max 8MB
                    </p>
                    <label
                      className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      style={accentButtonStyleFor(ui)}
                    >
                      {uploadingBrDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {uploadingBrDoc
                        ? 'Uploading…'
                        : profile.businessRegistrationDocUploaded
                          ? 'Replace document'
                          : 'Upload document'}
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        disabled={uploadingBrDoc || !workspace?.isOwner}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadOrganizerDocument('br', file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {profile.businessRegistrationDocUploaded ? (
                      <a
                        href={profile.businessRegistrationDocUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
                        style={{ color: ui.accent }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View uploaded BR
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed p-4" style={cardMutedStyle}>
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                    style={{ background: ui.accentSoft, color: ui.accent }}
                  >
                    <UploadCloud className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: ui.text }}>
                      Latest bank statement
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: ui.textMuted }}>
                      Optional · PDF, JPG, PNG, or WEBP · max 8MB
                    </p>
                    <label
                      className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      style={accentButtonStyleFor(ui)}
                    >
                      {uploadingBankStatementDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {uploadingBankStatementDoc
                        ? 'Uploading…'
                        : profile.bankStatementDocUploaded
                          ? 'Replace statement'
                          : 'Upload statement'}
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,image/png,image/jpeg,image/webp"
                        disabled={uploadingBankStatementDoc || !workspace?.isOwner}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadOrganizerDocument('bank_statement', file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {profile.bankStatementDocUploaded ? (
                      <a
                        href={profile.bankStatementDocUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
                        style={{ color: ui.accent }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View uploaded statement
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {workspace?.isOwner ? (
            <div className="mt-6">
              <FlowButton onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save organization profile'}
              </FlowButton>
            </div>
          ) : (
            <p className="mt-4 text-sm" style={{ color: ui.textMuted }}>
              Only the workspace owner can edit the organization profile.
            </p>
          )}
        </FlowCard>
        </section>

        <section id="org-terms">
        <FlowCard className="mt-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: ui.accent }} />
            <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
              Terms &amp; Conditions
            </h2>
          </div>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Your organization terms apply across all events. Attendees must accept them at checkout along with each
            event&apos;s policy.
          </p>
          <div className="mt-5 rounded-2xl border p-4" style={cardMutedStyle}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold" style={{ color: ui.text }}>
                  Organization terms
                </p>
                <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
                  Default template is ready — customize anytime.
                </p>
              </div>
              {workspace?.isOwner ? (
                <button
                  type="button"
                  onClick={() => setTermsModalOpen(true)}
                  className="shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold"
                  style={accentButtonStyleFor(ui)}
                >
                  Edit terms
                </button>
              ) : null}
            </div>
            <div
              className="event-policy-content max-h-40 overflow-hidden text-sm leading-relaxed opacity-90"
              style={{ color: ui.textMuted }}
              dangerouslySetInnerHTML={{ __html: termsHtml }}
            />
          </div>
        </FlowCard>
        </section>

        <section id="org-payments">
        <FlowCard className="mt-6">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: ui.accent }} />
            <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
              Payments
            </h2>
          </div>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Set up checkout, installments, bank transfer, and payouts — step by step.
          </p>
          <div className="mt-5">
            <OrganizerPaymentSettingsPanel
              isOwner={!!workspace?.isOwner}
              onFeedback={setFeedback}
              onError={setError}
            />
          </div>
        </FlowCard>
        </section>

        {workspace?.canManageTeam ? (
          <section id="org-team">
          <FlowCard className="mt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" style={{ color: ui.accent }} />
              <h2 className="text-lg font-semibold" style={{ color: ui.text }}>
                Team access
              </h2>
            </div>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Invite colleagues to help manage events. Admins can invite others; editors can manage events; viewers can
              view only.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: ui.textMuted }} />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className={`${fieldClass} w-full pl-10`}
                  style={fieldStyle}
                />
              </div>
              <TurnoutSelect
                value={inviteRole}
                onChange={(next) => setInviteRole(next as OrganizerTeamRole)}
                ariaLabel="Invite role"
                tone={ui.isDark ? 'dark' : 'light'}
                style={fieldStyle}
                buttonClassName={fieldClass}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'editor', label: 'Editor' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
              />
              <FlowButton onClick={sendInvite} disabled={inviting || !inviteEmail.trim()}>
                <UserPlus className="h-4 w-4" />
                {inviting ? 'Sending…' : 'Invite'}
              </FlowButton>
            </div>

            <div className="mt-6 space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                  style={cardMutedStyle}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                      style={{ background: ui.accentSoft, color: ui.accent }}
                    >
                      {m.isOwner ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ color: ui.text }}>
                        {m.displayName}
                      </p>
                      <p className="truncate text-sm" style={{ color: ui.textMuted }}>
                        {m.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
                      style={{ background: ui.accentSoft, color: ui.accent }}
                    >
                      {ROLE_LABELS[m.role]}
                    </span>
                    {!m.isOwner && workspace.isOwner ? (
                      <button
                        type="button"
                        onClick={() => removeMember(m.memberUserId)}
                        className="rounded-lg border border-rose-200 p-2 text-rose-600"
                        aria-label={`Remove ${m.displayName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {invites.length > 0 ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textSubtle }}>
                  Pending invites
                </p>
                <div className="mt-2 space-y-2">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm"
                      style={{ borderColor: ui.borderColor }}
                    >
                      <span style={{ color: ui.text }}>
                        {inv.email} · {ROLE_LABELS[inv.role]}
                      </span>
                      <button
                        type="button"
                        onClick={() => revokeInvite(inv.id)}
                        className="text-xs font-semibold underline-offset-2 hover:underline"
                        style={{ color: ui.textMuted }}
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </FlowCard>
          </section>
        ) : null}
      </FlowPage>
      <EventPolicyEditorModal
        open={termsModalOpen}
        title="Terms & Conditions"
        value={termsHtml}
        defaultTemplate={DEFAULT_ORGANIZER_TERMS_HTML}
        ui={ui}
        saving={savingTerms}
        onClose={() => setTermsModalOpen(false)}
        onSave={(html) => void saveTerms(html)}
      />
    </OrganizerFlowShell>
  );
};
