import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, CreditCard, Landmark, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import {
  OrganizerBillingPreapproveResponse,
  OrganizerGatewayMode,
  OrganizerPaidEventReadiness,
  OrganizerPaymentSettings,
} from '../../types';
import { startPayHerePreapprove } from '../../lib/payhereCheckout';
import { formatApiError } from '../../utils/apiError';
import { FlowAlert, FlowButton, FlowInput, FlowLabel } from '../flow/FlowPrimitives';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { cardMutedStyleFor, cardStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';
import { cn } from '../../utils/cn';

type Props = {
  isOwner: boolean;
  onFeedback?: (message: string) => void;
  onError?: (message: string) => void;
};

type ExpandedProvider = 'payhere' | 'bank_transfer' | null;

function StatusBadge({ active }: { active: boolean }) {
  const ui = APP_FLOW_UI;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={
        active
          ? { background: 'rgba(16, 185, 129, 0.14)', color: '#059669' }
          : { background: 'rgba(245, 158, 11, 0.16)', color: '#d97706' }
      }
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function ProviderRow({
  title,
  detail,
  active,
  expanded,
  onToggle,
  icons,
  children,
}: {
  title: string;
  detail: string;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  icons?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const ui = APP_FLOW_UI;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold" style={{ color: ui.text }}>
              {title}
            </p>
            {icons}
          </div>
          <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
            {detail}
          </p>
        </div>
        <StatusBadge active={active} />
        <ChevronRight
          className={cn('h-4 w-4 shrink-0 transition-transform', expanded && 'rotate-90')}
          style={{ color: ui.textMuted }}
        />
      </button>
      {expanded ? (
        <div className="border-t px-4 py-4" style={{ borderColor: ui.borderColor }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const OrganizerPaymentSettingsPanel: React.FC<Props> = ({ isOwner, onFeedback, onError }) => {
  const ui = APP_FLOW_UI;
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardStyle = cardStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrganizerPaymentSettings | null>(null);
  const [gatewayMode, setGatewayMode] = useState<OrganizerGatewayMode>('turnout');
  const [merchantId, setMerchantId] = useState('');
  const [merchantSecret, setMerchantSecret] = useState('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountType, setBankAccountType] = useState('');
  const [bankAddress, setBankAddress] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankBranchCode, setBankBranchCode] = useState('');
  const [bankSwiftCode, setBankSwiftCode] = useState('');
  const [readiness, setReadiness] = useState<OrganizerPaidEventReadiness | null>(null);
  const [expanded, setExpanded] = useState<ExpandedProvider>('payhere');

  const loadSettings = useCallback(async () => {
    const res = await api.get<{ settings: OrganizerPaymentSettings; readiness: OrganizerPaidEventReadiness }>(
      '/api/organizer/provider-settings'
    );
    setSettings(res.settings);
    setReadiness(res.readiness);
    setGatewayMode(res.settings.gatewayMode);
    setMerchantId(res.settings.ownPayhereMerchantId || '');
    setMerchantSecret('');
    setBankAccountHolderName(res.readiness.bank.bankAccountHolderName || '');
    setBankName(res.readiness.bank.bankName || '');
    setBankBranch(res.readiness.bank.bankBranch || '');
    setBankAccountNumber('');
    setBankAccountType(res.readiness.bank.bankAccountType || '');
    setBankAddress(res.readiness.bank.bankAddress || '');
    setBankCode(res.readiness.bank.bankCode || '');
    setBankBranchCode(res.readiness.bank.bankBranchCode || '');
    setBankSwiftCode(res.readiness.bank.bankSwiftCode || '');
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        await loadSettings();
      } catch (e: unknown) {
        const message = formatApiError(e, 'Failed to load payment settings');
        setLoadError(message);
        onError?.(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSettings, onError]);

  const savePayhereSettings = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { gatewayMode };
      if (gatewayMode === 'own_payhere') {
        body.ownPayhereMerchantId = merchantId.trim();
        if (merchantSecret.trim()) {
          body.ownPayhereMerchantSecret = merchantSecret.trim();
        }
      }
      const res = await api.post<{
        settings: OrganizerPaymentSettings;
        readiness: OrganizerPaidEventReadiness;
      }>('/api/organizer/provider-settings', body);
      setSettings(res.settings);
      setReadiness(res.readiness);
      setMerchantSecret('');
      onFeedback?.('PayHere settings saved.');
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Failed to save PayHere settings'));
    } finally {
      setSaving(false);
    }
  };

  const saveBankAccount = async () => {
    setSaving(true);
    try {
      if (!bankAccountHolderName.trim() || !bankName.trim() || !bankBranch.trim()) {
        onError?.('Account holder name, bank name, and branch are required.');
        return;
      }
      if (!bankAccountNumber.trim() && !readiness?.bank.bankAccountConfigured) {
        onError?.('Enter your bank account number.');
        return;
      }

      const body: Record<string, string> = {
        gatewayMode,
        bankAccountHolderName: bankAccountHolderName.trim(),
        bankName: bankName.trim(),
        bankBranch: bankBranch.trim(),
        bankAccountType: bankAccountType.trim(),
        bankAddress: bankAddress.trim(),
        bankCode: bankCode.trim(),
        bankBranchCode: bankBranchCode.trim(),
        bankSwiftCode: bankSwiftCode.trim(),
      };
      if (bankAccountNumber.trim()) {
        body.bankAccountNumber = bankAccountNumber.trim();
      }
      const res = await api.post<{
        settings: OrganizerPaymentSettings;
        readiness: OrganizerPaidEventReadiness;
      }>('/api/organizer/provider-settings', body);
      setSettings(res.settings);
      setReadiness(res.readiness);
      setBankAccountNumber('');
      onFeedback?.(
        res.readiness?.isReady
          ? 'Bank account saved. You can publish paid events now.'
          : 'Bank account saved.'
      );
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Failed to save bank account'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm" style={{ color: ui.textMuted }}>
        Loading payment methods…
      </div>
    );
  }

  if (loadError) {
    return <FlowAlert variant="error">{loadError}</FlowAlert>;
  }

  const commissionPct = settings?.commissionPct ?? 10;
  const payhereActive =
    gatewayMode === 'turnout'
      ? true
      : !!(settings?.ownPayhereMerchantId && settings?.ownPayhereSecretConfigured);
  const bankActive = !!(
    readiness?.bank.bankAccountHolderName &&
    readiness?.bank.bankName &&
    readiness?.bank.bankBranch &&
    readiness?.bank.bankAccountConfigured
  );

  const toggleExpand = (id: ExpandedProvider) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold" style={{ color: ui.text }}>
          Payment providers
        </h3>
        <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
          Providers that let attendees pay online at checkout. A {commissionPct}% platform fee applies to card payments
          processed through Turnout.
        </p>
        <div className="mt-3 overflow-hidden rounded-2xl border" style={cardStyle}>
          <ProviderRow
            title="PayHere"
            detail={
              gatewayMode === 'turnout'
                ? `${commissionPct}% platform fee · Turnout handles checkout & payouts`
                : `${commissionPct}% platform fee · Your PayHere merchant · processing fees apply`
            }
            active={payhereActive}
            expanded={expanded === 'payhere'}
            onToggle={() => toggleExpand('payhere')}
            icons={
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                <CreditCard className="h-3.5 w-3.5" />
                Cards
              </span>
            }
          >
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!isOwner}
                  onClick={() => setGatewayMode('turnout')}
                  className="rounded-xl border p-3 text-left transition"
                  style={{
                    ...cardMutedStyle,
                    borderColor: gatewayMode === 'turnout' ? ui.accent : ui.borderColor,
                    boxShadow: gatewayMode === 'turnout' ? `0 0 0 1px ${ui.accent}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
                    <ShieldCheck className="h-4 w-4" style={{ color: ui.accent }} />
                    Turnout Pay
                  </div>
                  <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                    Use Turnout&apos;s PayHere account. Fees deducted automatically; payouts go to your bank.
                  </p>
                </button>
                <button
                  type="button"
                  disabled={!isOwner}
                  onClick={() => setGatewayMode('own_payhere')}
                  className="rounded-xl border p-3 text-left transition"
                  style={{
                    ...cardMutedStyle,
                    borderColor: gatewayMode === 'own_payhere' ? ui.accent : ui.borderColor,
                    boxShadow: gatewayMode === 'own_payhere' ? `0 0 0 1px ${ui.accent}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
                    <Landmark className="h-4 w-4" style={{ color: ui.accent }} />
                    Your PayHere account
                  </div>
                  <p className="mt-1 text-xs" style={{ color: ui.textMuted }}>
                    Connect your merchant ID &amp; secret. Payments go directly to you.
                  </p>
                </button>
              </div>

              {gatewayMode === 'own_payhere' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <FlowLabel>PayHere merchant ID</FlowLabel>
                    <FlowInput
                      value={merchantId}
                      disabled={!isOwner}
                      onChange={(e) => setMerchantId(e.target.value)}
                      placeholder="121XXXX"
                      className={fieldClass}
                      style={fieldStyle}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <FlowLabel>PayHere merchant secret</FlowLabel>
                    <FlowInput
                      type="password"
                      value={merchantSecret}
                      disabled={!isOwner}
                      onChange={(e) => setMerchantSecret(e.target.value)}
                      placeholder={settings?.ownPayhereSecretConfigured ? '••••••••••••••••' : 'Paste merchant secret'}
                      className={fieldClass}
                      style={fieldStyle}
                    />
                  </label>
                </div>
              ) : (
                <p className="text-sm" style={{ color: ui.textMuted }}>
                  Turnout Pay is ready for card checkout. Add your bank account below so we can send payouts.
                </p>
              )}

              {isOwner ? (
                <FlowButton onClick={savePayhereSettings} disabled={saving}>
                  {saving ? 'Saving…' : 'Save PayHere settings'}
                </FlowButton>
              ) : null}
            </div>
          </ProviderRow>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold" style={{ color: ui.text }}>
          Additional payment methods
        </h3>
        <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
          Offer methods processed offsite. Enable each method per event after setup.
        </p>
        <div className="mt-3 overflow-hidden rounded-2xl border" style={cardStyle}>
          <ProviderRow
            title="Bank transfer"
            detail="Manual transfer · attendee uploads slip · you confirm"
            active={bankActive}
            expanded={expanded === 'bank_transfer'}
            onToggle={() => toggleExpand('bank_transfer')}
            icons={
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: ui.textMuted }}>
                <Landmark className="h-3.5 w-3.5" />
                LKR
              </span>
            }
          >
            <div className="space-y-4">
              <p className="text-sm" style={{ color: ui.textMuted }}>
                These details are shown to attendees when you enable bank transfer on an event. Also used for Turnout Pay
                payouts.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <FlowLabel>Account name</FlowLabel>
                  <FlowInput
                    value={bankAccountHolderName}
                    disabled={!isOwner}
                    onChange={(e) => setBankAccountHolderName(e.target.value)}
                    placeholder="Name as shown on bank account"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <FlowLabel>Account number</FlowLabel>
                  <FlowInput
                    type="password"
                    value={bankAccountNumber}
                    disabled={!isOwner}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder={
                      readiness?.bank.bankAccountConfigured
                        ? `Saved · ends ${readiness.bank.bankAccountNumberLast4 || '****'}`
                        : 'Enter account number'
                    }
                    className={fieldClass}
                    style={fieldStyle}
                  />
                  {readiness?.bank.bankAccountConfigured ? (
                    <p className="text-xs" style={{ color: ui.textMuted }}>
                      Account number is saved. Leave blank to keep the current number.
                    </p>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1.5">
                  <FlowLabel>Account type</FlowLabel>
                  <FlowInput
                    value={bankAccountType}
                    disabled={!isOwner}
                    onChange={(e) => setBankAccountType(e.target.value)}
                    placeholder="e.g. Current Account"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <FlowLabel>Bank name</FlowLabel>
                  <FlowInput
                    value={bankName}
                    disabled={!isOwner}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Hatton National Bank PLC"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <FlowLabel>Bank address</FlowLabel>
                  <FlowInput
                    value={bankAddress}
                    disabled={!isOwner}
                    onChange={(e) => setBankAddress(e.target.value)}
                    placeholder="Bank branch address"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <FlowLabel>Bank branch</FlowLabel>
                  <FlowInput
                    value={bankBranch}
                    disabled={!isOwner}
                    onChange={(e) => setBankBranch(e.target.value)}
                    placeholder="e.g. WTC Branch"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <FlowLabel>BANK code</FlowLabel>
                  <FlowInput
                    value={bankCode}
                    disabled={!isOwner}
                    onChange={(e) => setBankCode(e.target.value)}
                    placeholder="e.g. 7083"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <FlowLabel>Branch code</FlowLabel>
                  <FlowInput
                    value={bankBranchCode}
                    disabled={!isOwner}
                    onChange={(e) => setBankBranchCode(e.target.value)}
                    placeholder="e.g. 703"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <FlowLabel>Swift code</FlowLabel>
                  <FlowInput
                    value={bankSwiftCode}
                    disabled={!isOwner}
                    onChange={(e) => setBankSwiftCode(e.target.value)}
                    placeholder="e.g. HBLILKLX"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
              </div>
              {isOwner ? (
                <FlowButton onClick={saveBankAccount} disabled={saving}>
                  {saving ? 'Saving…' : 'Save bank account'}
                </FlowButton>
              ) : (
                <p className="text-sm" style={{ color: ui.textMuted }}>
                  Only the workspace owner can change payment settings.
                </p>
              )}
            </div>
          </ProviderRow>
        </div>
      </section>
    </div>
  );
};

export const OrganizerBillingCardPanel: React.FC<Props> = ({ isOwner, onFeedback, onError }) => {
  const ui = APP_FLOW_UI;
  const [loading, setLoading] = useState(true);
  const [addingCard, setAddingCard] = useState(false);
  const [settings, setSettings] = useState<OrganizerPaymentSettings | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ settings: OrganizerPaymentSettings; readiness: OrganizerPaidEventReadiness }>(
      '/api/organizer/provider-settings'
    );
    setSettings(res.settings);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e: unknown) {
        onError?.(formatApiError(e, 'Failed to load billing settings'));
      } finally {
        setLoading(false);
      }
    })();
  }, [load, onError]);

  const addBillingCard = async () => {
    setAddingCard(true);
    try {
      const res = await api.post<OrganizerBillingPreapproveResponse>('/api/organizer/billing/preapprove', {});
      await startPayHerePreapprove(res, {
        onCompleted: async (setupOrderId) => {
          const statusRes = await api.get<{ sessionStatus: string; settings: OrganizerPaymentSettings }>(
            `/api/organizer/billing/status?setup_order_id=${encodeURIComponent(setupOrderId)}`
          );
          setSettings(statusRes.settings);
          if (statusRes.settings.billing.status === 'active') {
            onFeedback?.('Billing card saved. Automatic platform fee charging is now enabled.');
          } else {
            onError?.('Card setup did not complete. Try again.');
          }
          setAddingCard(false);
        },
        onDismissed: () => setAddingCard(false),
        onError: (message) => {
          onError?.(message);
          setAddingCard(false);
        },
      });
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Could not start billing card setup'));
      setAddingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm" style={{ color: ui.textMuted }}>
        Loading billing…
      </div>
    );
  }

  const billingActive = settings?.billing.status === 'active';
  const commissionPct = settings?.commissionPct ?? 10;
  const cardMutedStyle = cardMutedStyleFor(ui);

  return (
    <div className="rounded-2xl border p-4" style={cardMutedStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold" style={{ color: ui.text }}>
            Billing card for platform fees
          </p>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Optional when using your own PayHere account. Used to collect the {commissionPct}% platform fee.
          </p>
        </div>
        {billingActive ? (
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            style={{ background: ui.accentSoft, color: ui.accent }}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {settings?.billing.cardBrand || 'Card'} ···· {settings?.billing.cardLast4 || '****'}
          </span>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: ui.textMuted }}>
            Not set up
          </span>
        )}
      </div>
      {isOwner ? (
        <div className="mt-4">
          <FlowButton onClick={addBillingCard} disabled={addingCard}>
            {addingCard ? 'Opening secure card form…' : billingActive ? 'Update billing card' : 'Add billing card'}
          </FlowButton>
        </div>
      ) : null}
    </div>
  );
};
