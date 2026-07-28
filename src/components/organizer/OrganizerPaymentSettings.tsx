import React, { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, CreditCard, Landmark, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react';
import { api } from '../../api/client';
import {
  OrganizerBillingPreapproveResponse,
  OrganizerGatewayMode,
  OrganizerInstallmentMode,
  OrganizerOwnGatewayId,
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

type ExpandedSection = 'providers' | 'installments' | 'bank_transfer' | 'payouts' | null;

const OWN_GATEWAY_OPTIONS: Array<{
  id: OrganizerOwnGatewayId;
  name: string;
  available: boolean;
  accent: string;
  mark: string;
}> = [
  { id: 'payhere', name: 'PayHere', available: true, accent: '#0A6CFF', mark: 'PH' },
  { id: 'webx', name: 'WebX Pay', available: false, accent: '#111827', mark: 'WX' },
  { id: 'directpay', name: 'DirectPay', available: false, accent: '#0F766E', mark: 'DP' },
];

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={
        active
          ? { background: 'rgba(16, 185, 129, 0.14)', color: '#059669' }
          : { background: 'rgba(148, 163, 184, 0.18)', color: '#64748b' }
      }
    >
      {label || (active ? 'Active' : 'Off')}
    </span>
  );
}

function BrandMark({ mark, accent }: { mark: string; accent: string }) {
  return (
    <span
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold tracking-wide text-white"
      style={{ background: accent }}
      aria-hidden
    >
      {mark}
    </span>
  );
}

function SectionCard({
  title,
  detail,
  active,
  badgeLabel,
  expanded,
  onToggle,
  children,
  icon,
}: {
  title: string;
  detail: string;
  active: boolean;
  badgeLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const ui = APP_FLOW_UI;
  return (
    <div className="overflow-hidden rounded-2xl border" style={cardStyleFor(ui)}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-black/[0.02]"
      >
        {icon ? (
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: ui.accentSoft, color: ui.accent }}
          >
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="font-semibold" style={{ color: ui.text }}>
            {title}
          </p>
          <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
            {detail}
          </p>
        </div>
        <StatusBadge active={active} label={badgeLabel} />
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

function ChoiceCard({
  selected,
  disabled,
  title,
  detail,
  onClick,
  trailing,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  detail: string;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  const ui = APP_FLOW_UI;
  const muted = cardMutedStyleFor(ui);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        ...muted,
        borderColor: selected ? ui.accent : ui.borderColor,
        boxShadow: selected ? `0 0 0 1px ${ui.accent}` : undefined,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border"
          style={{
            borderColor: selected ? ui.accent : ui.borderColor,
            background: selected ? ui.accent : 'transparent',
            color: selected ? '#fff' : 'transparent',
          }}
        >
          <Check className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: ui.text }}>
              {title}
            </p>
            {trailing}
          </div>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: ui.textMuted }}>
            {detail}
          </p>
        </div>
      </div>
    </button>
  );
}

export const OrganizerPaymentSettingsPanel: React.FC<Props> = ({ isOwner, onFeedback, onError }) => {
  const ui = APP_FLOW_UI;
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<OrganizerPaymentSettings | null>(null);
  const [gatewayMode, setGatewayMode] = useState<OrganizerGatewayMode>('turnout');
  const [ownGateway, setOwnGateway] = useState<OrganizerOwnGatewayId | null>(null);
  const [installmentMode, setInstallmentMode] = useState<OrganizerInstallmentMode>('off');
  const [ownKokoEnabled, setOwnKokoEnabled] = useState(false);
  const [ownMintpayEnabled, setOwnMintpayEnabled] = useState(false);
  const [merchantId, setMerchantId] = useState('');
  const [merchantSecret, setMerchantSecret] = useState('');
  const [kokoMerchantId, setKokoMerchantId] = useState('');
  const [kokoMerchantSecret, setKokoMerchantSecret] = useState('');
  const [mintpayMerchantId, setMintpayMerchantId] = useState('');
  const [mintpayMerchantSecret, setMintpayMerchantSecret] = useState('');
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
  const [expanded, setExpanded] = useState<ExpandedSection>(null);
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [bankTransferEnabled, setBankTransferEnabled] = useState(true);

  const applySettings = useCallback((next: OrganizerPaymentSettings, nextReadiness: OrganizerPaidEventReadiness) => {
    setSettings(next);
    setReadiness(nextReadiness);
    setGatewayMode(next.gatewayMode || 'turnout');
    setOwnGateway(next.ownGateway || (next.gatewayMode === 'own_payhere' ? 'payhere' : null));
    setInstallmentMode(next.installmentMode || 'off');
    setOwnKokoEnabled(!!next.ownKokoEnabled);
    setOwnMintpayEnabled(!!next.ownMintpayEnabled);
    setMerchantId(next.ownPayhereMerchantId || '');
    setMerchantSecret('');
    setKokoMerchantId(next.ownKokoMerchantId || '');
    setKokoMerchantSecret('');
    setMintpayMerchantId(next.ownMintpayMerchantId || '');
    setMintpayMerchantSecret('');
    setBankAccountHolderName(nextReadiness.bank.bankAccountHolderName || '');
    setBankName(nextReadiness.bank.bankName || '');
    setBankBranch(nextReadiness.bank.bankBranch || '');
    setBankAccountNumber('');
    setBankAccountType(nextReadiness.bank.bankAccountType || '');
    setBankAddress(nextReadiness.bank.bankAddress || '');
    setBankCode(nextReadiness.bank.bankCode || '');
    setBankBranchCode(nextReadiness.bank.bankBranchCode || '');
    setBankSwiftCode(nextReadiness.bank.bankSwiftCode || '');

    const payoutReady = !!(
      nextReadiness.bank.bankAccountHolderName &&
      nextReadiness.bank.bankName &&
      nextReadiness.bank.bankBranch &&
      nextReadiness.bank.bankAccountConfigured
    );
    setExpanded((prev) => {
      if (prev) return prev;
      return payoutReady ? 'providers' : 'payouts';
    });
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await api.get<{ settings: OrganizerPaymentSettings; readiness: OrganizerPaidEventReadiness }>(
      '/api/organizer/provider-settings'
    );
    applySettings(res.settings, res.readiness);
  }, [applySettings]);

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

  const postSettings = async (body: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    try {
      const res = await api.post<{
        settings: OrganizerPaymentSettings;
        readiness: OrganizerPaidEventReadiness;
      }>('/api/organizer/provider-settings', body);
      applySettings(res.settings, res.readiness);
      onFeedback?.(successMessage);
      return res;
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Failed to save payment settings'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const selectTurnoutPay = async () => {
    if (!isOwner || gatewayMode === 'turnout') {
      setGatewayMode('turnout');
      setOwnGateway(null);
      return;
    }
    await postSettings({ gatewayMode: 'turnout', ownGateway: null }, 'Turnout Pay is now your default checkout.');
  };

  const selectOwnGatewayFromModal = async (id: OrganizerOwnGatewayId) => {
    const option = OWN_GATEWAY_OPTIONS.find((item) => item.id === id);
    if (!option?.available) return;
    setOwnGateway(id);
    setGatewayMode('own_payhere');
    setGatewayModalOpen(false);
    setExpanded('providers');
  };

  const saveOwnGatewayCredentials = async () => {
    if (!merchantId.trim()) {
      onError?.('Enter your merchant ID.');
      return;
    }
    if (!merchantSecret.trim() && !settings?.ownPayhereSecretConfigured) {
      onError?.('Enter your merchant secret.');
      return;
    }
    const body: Record<string, unknown> = {
      gatewayMode: 'own_payhere',
      ownGateway: ownGateway || 'payhere',
      ownPayhereMerchantId: merchantId.trim(),
    };
    if (merchantSecret.trim()) body.ownPayhereMerchantSecret = merchantSecret.trim();
    await postSettings(body, 'Your payment gateway is connected.');
  };

  const saveInstallments = async (nextMode: OrganizerInstallmentMode, nextKoko = ownKokoEnabled, nextMint = ownMintpayEnabled) => {
    setInstallmentMode(nextMode);
    setOwnKokoEnabled(nextKoko);
    setOwnMintpayEnabled(nextMint);
    const body: Record<string, unknown> = {
      gatewayMode,
      ownGateway: gatewayMode === 'own_payhere' ? ownGateway || 'payhere' : null,
      installmentMode: nextMode,
      ownKokoEnabled: nextMode === 'own' ? nextKoko : false,
      ownMintpayEnabled: nextMode === 'own' ? nextMint : false,
    };
    if (nextMode === 'own') {
      if (kokoMerchantId.trim()) body.ownKokoMerchantId = kokoMerchantId.trim();
      if (kokoMerchantSecret.trim()) body.ownKokoMerchantSecret = kokoMerchantSecret.trim();
      if (mintpayMerchantId.trim()) body.ownMintpayMerchantId = mintpayMerchantId.trim();
      if (mintpayMerchantSecret.trim()) body.ownMintpayMerchantSecret = mintpayMerchantSecret.trim();
    }
    await postSettings(
      body,
      nextMode === 'off'
        ? 'Installment payments turned off.'
        : nextMode === 'turnout'
          ? 'Turnout Installments enabled.'
          : 'Your installment providers were saved.'
    );
  };

  const saveBankAccount = async () => {
    if (!bankAccountHolderName.trim() || !bankName.trim() || !bankBranch.trim()) {
      onError?.('Account holder name, bank name, and branch are required.');
      return;
    }
    if (!bankAccountNumber.trim() && !readiness?.bank.bankAccountConfigured) {
      onError?.('Enter your bank account number.');
      return;
    }

    const body: Record<string, unknown> = {
      gatewayMode,
      ownGateway: gatewayMode === 'own_payhere' ? ownGateway || 'payhere' : null,
      installmentMode,
      ownKokoEnabled,
      ownMintpayEnabled,
      bankAccountHolderName: bankAccountHolderName.trim(),
      bankName: bankName.trim(),
      bankBranch: bankBranch.trim(),
      bankAccountType: bankAccountType.trim(),
      bankAddress: bankAddress.trim(),
      bankCode: bankCode.trim(),
      bankBranchCode: bankBranchCode.trim(),
      bankSwiftCode: bankSwiftCode.trim(),
    };
    if (bankAccountNumber.trim()) body.bankAccountNumber = bankAccountNumber.trim();

    const res = await postSettings(
      body,
      readiness?.isReady || gatewayMode === 'own_payhere'
        ? 'Payout bank account saved.'
        : 'Payout bank account saved. You can publish paid events now.'
    );
    if (res?.readiness?.isReady) {
      // keep success copy above
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

  const turnoutActive = gatewayMode === 'turnout';
  const ownGatewayActive = gatewayMode === 'own_payhere' && !!settings?.ownPayhereSecretConfigured;
  const providersActive = turnoutActive || ownGatewayActive;
  const installmentsActive = installmentMode !== 'off';
  const payoutsReady = !!(
    readiness?.bank.bankAccountHolderName &&
    readiness?.bank.bankName &&
    readiness?.bank.bankBranch &&
    readiness?.bank.bankAccountConfigured
  );

  const toggleExpand = (id: ExpandedSection) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: ui.text }}>
            Payment providers
          </h3>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Choose how attendees pay online. Turnout Pay is the default for every new organizer.
          </p>
        </div>

        <SectionCard
          title="Online checkout"
          detail={
            turnoutActive
              ? 'Turnout Pay is active'
              : ownGatewayActive
                ? 'Using your own gateway'
                : 'Connect a checkout option'
          }
          active={providersActive}
          badgeLabel={turnoutActive ? 'Turnout Pay' : ownGatewayActive ? 'Own gateway' : 'Setup needed'}
          expanded={expanded === 'providers'}
          onToggle={() => toggleExpand('providers')}
          icon={<Wallet className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <ChoiceCard
              selected={turnoutActive}
              disabled={!isOwner}
              title="Turnout Pay"
              detail="Recommended default. Attendees check out through Turnout and payouts go to your linked bank account."
              onClick={() => void selectTurnoutPay()}
              trailing={
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: ui.accentSoft, color: ui.accent }}
                >
                  Default
                </span>
              }
            />

            <ChoiceCard
              selected={gatewayMode === 'own_payhere'}
              disabled={!isOwner}
              title="Use your own gateway"
              detail="Connect a merchant account you already own. Pick a provider from the list."
              onClick={() => {
                if (!isOwner) return;
                setGatewayModalOpen(true);
              }}
            />

            {gatewayMode === 'own_payhere' ? (
              <div className="rounded-xl border p-4" style={cardMutedStyle}>
                <div className="flex items-center gap-3">
                  <BrandMark mark="PH" accent="#0A6CFF" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: ui.text }}>
                      Gateway credentials
                    </p>
                    <p className="text-xs" style={{ color: ui.textMuted }}>
                      Only PayHere is available right now. Other gateways are coming soon.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <label className="flex flex-col gap-1.5">
                    <FlowLabel>Merchant ID</FlowLabel>
                    <FlowInput
                      value={merchantId}
                      disabled={!isOwner}
                      onChange={(e) => setMerchantId(e.target.value)}
                      placeholder="Your merchant ID"
                      className={fieldClass}
                      style={fieldStyle}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <FlowLabel>Merchant secret</FlowLabel>
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
                {isOwner ? (
                  <div className="mt-4">
                    <FlowButton onClick={() => void saveOwnGatewayCredentials()} disabled={saving}>
                      {saving ? 'Saving…' : 'Save gateway'}
                    </FlowButton>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm" style={{ color: ui.textMuted }}>
                Complete the payouts setup below so we can send your earnings.
              </p>
            )}
          </div>
        </SectionCard>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: ui.text }}>
            Installment payments
          </h3>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Let attendees pay in installments with Koko or Mintpay.
          </p>
        </div>

        <SectionCard
          title="Installments"
          detail={
            installmentMode === 'turnout'
              ? 'Turnout Installments'
              : installmentMode === 'own'
                ? 'Your own installment providers'
                : 'Not enabled'
          }
          active={installmentsActive}
          expanded={expanded === 'installments'}
          onToggle={() => toggleExpand('installments')}
          icon={<Sparkles className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <ChoiceCard
              selected={installmentMode === 'off'}
              disabled={!isOwner}
              title="Off"
              detail="Do not offer installment checkout."
              onClick={() => void saveInstallments('off')}
            />
            <ChoiceCard
              selected={installmentMode === 'turnout'}
              disabled={!isOwner}
              title="Turnout Installments"
              detail="Use Turnout’s Koko and Mintpay connections. No extra merchant setup needed."
              onClick={() => void saveInstallments('turnout')}
              trailing={
                <span className="inline-flex items-center gap-1.5">
                  <BrandMark mark="K" accent="#7C3AED" />
                  <BrandMark mark="M" accent="#059669" />
                </span>
              }
            />
            <ChoiceCard
              selected={installmentMode === 'own'}
              disabled={!isOwner}
              title="Link your own"
              detail="Connect your own Koko and Mintpay merchant accounts."
              onClick={() => {
                setInstallmentMode('own');
                setExpanded('installments');
              }}
            />

            {installmentMode === 'own' ? (
              <div className="space-y-4 rounded-xl border p-4" style={cardMutedStyle}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={ownKokoEnabled}
                    disabled={!isOwner}
                    onChange={(e) => setOwnKokoEnabled(e.target.checked)}
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
                      <BrandMark mark="K" accent="#7C3AED" />
                      Koko
                    </span>
                    <span className="mt-1 block text-xs" style={{ color: ui.textMuted }}>
                      Link your Koko merchant credentials.
                    </span>
                  </span>
                </label>
                {ownKokoEnabled ? (
                  <div className="grid gap-3 pl-8">
                    <label className="flex flex-col gap-1.5">
                      <FlowLabel>Koko merchant ID</FlowLabel>
                      <FlowInput
                        value={kokoMerchantId}
                        disabled={!isOwner}
                        onChange={(e) => setKokoMerchantId(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FlowLabel>Koko merchant secret</FlowLabel>
                      <FlowInput
                        type="password"
                        value={kokoMerchantSecret}
                        disabled={!isOwner}
                        onChange={(e) => setKokoMerchantSecret(e.target.value)}
                        placeholder={settings?.ownKokoSecretConfigured ? '••••••••••••••••' : 'Paste secret'}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </label>
                  </div>
                ) : null}

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={ownMintpayEnabled}
                    disabled={!isOwner}
                    onChange={(e) => setOwnMintpayEnabled(e.target.checked)}
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: ui.text }}>
                      <BrandMark mark="M" accent="#059669" />
                      Mintpay
                    </span>
                    <span className="mt-1 block text-xs" style={{ color: ui.textMuted }}>
                      Link your Mintpay merchant credentials.
                    </span>
                  </span>
                </label>
                {ownMintpayEnabled ? (
                  <div className="grid gap-3 pl-8">
                    <label className="flex flex-col gap-1.5">
                      <FlowLabel>Mintpay merchant ID</FlowLabel>
                      <FlowInput
                        value={mintpayMerchantId}
                        disabled={!isOwner}
                        onChange={(e) => setMintpayMerchantId(e.target.value)}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FlowLabel>Mintpay merchant secret</FlowLabel>
                      <FlowInput
                        type="password"
                        value={mintpayMerchantSecret}
                        disabled={!isOwner}
                        onChange={(e) => setMintpayMerchantSecret(e.target.value)}
                        placeholder={settings?.ownMintpaySecretConfigured ? '••••••••••••••••' : 'Paste secret'}
                        className={fieldClass}
                        style={fieldStyle}
                      />
                    </label>
                  </div>
                ) : null}

                {isOwner ? (
                  <FlowButton
                    onClick={() => void saveInstallments('own', ownKokoEnabled, ownMintpayEnabled)}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save installment providers'}
                  </FlowButton>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: ui.text }}>
            Bank transfer
          </h3>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Accept manual bank transfers. Attendees upload a slip and you confirm payment.
          </p>
        </div>

        <SectionCard
          title="Bank transfer"
          detail={bankTransferEnabled ? 'Available to enable on each event' : 'Turned off'}
          active={bankTransferEnabled}
          expanded={expanded === 'bank_transfer'}
          onToggle={() => toggleExpand('bank_transfer')}
          icon={<Landmark className="h-5 w-5" />}
        >
          <div className="space-y-3">
            <ChoiceCard
              selected={bankTransferEnabled}
              disabled={!isOwner}
              title="Offer bank transfer"
              detail="Uses the payout bank account below. Enable it per event from Event Settings."
              onClick={() => setBankTransferEnabled(true)}
            />
            <ChoiceCard
              selected={!bankTransferEnabled}
              disabled={!isOwner}
              title="Don’t offer bank transfer"
              detail="Hide this method from new event setups."
              onClick={() => setBankTransferEnabled(false)}
            />
            {!payoutsReady ? (
              <FlowAlert variant="info">Add your bank account in Payouts setup below before using bank transfer.</FlowAlert>
            ) : null}
          </div>
        </SectionCard>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: ui.text }}>
            Payouts setup
          </h3>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Link the bank account where your ticket earnings should be sent.
          </p>
        </div>

        <SectionCard
          title="Bank account for payouts"
          detail={payoutsReady ? 'Bank account linked' : 'Required for Turnout Pay and bank transfer'}
          active={payoutsReady}
          badgeLabel={payoutsReady ? 'Linked' : 'Required'}
          expanded={expanded === 'payouts'}
          onToggle={() => toggleExpand('payouts')}
          icon={<ShieldCheck className="h-5 w-5" />}
        >
          <div className="space-y-4">
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
              <FlowButton onClick={() => void saveBankAccount()} disabled={saving}>
                {saving ? 'Saving…' : 'Save payout bank account'}
              </FlowButton>
            ) : (
              <p className="text-sm" style={{ color: ui.textMuted }}>
                Only the workspace owner can change payment settings.
              </p>
            )}
          </div>
        </SectionCard>
      </section>

      {gatewayModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl"
            style={{ borderColor: ui.borderColor }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="own-gateway-title"
          >
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: ui.borderColor }}>
              <div>
                <h3 id="own-gateway-title" className="text-base font-semibold" style={{ color: ui.text }}>
                  Choose your gateway
                </h3>
                <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                  Select a provider to connect. More options are on the way.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGatewayModalOpen(false)}
                className="rounded-lg p-1.5 hover:bg-black/[0.04]"
                aria-label="Close"
              >
                <X className="h-4 w-4" style={{ color: ui.textMuted }} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              {OWN_GATEWAY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!isOwner || !option.available}
                  onClick={() => void selectOwnGatewayFromModal(option.id)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition hover:bg-black/[0.02] disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ borderColor: ui.borderColor }}
                >
                  <BrandMark mark={option.mark} accent={option.accent} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: ui.text }}>
                      {option.name}
                    </p>
                    <p className="text-xs" style={{ color: ui.textMuted }}>
                      {option.available ? 'Available now' : 'Coming soon'}
                    </p>
                  </div>
                  {option.available ? (
                    <span className="text-xs font-semibold" style={{ color: ui.accent }}>
                      Connect
                    </span>
                  ) : (
                    <StatusBadge active={false} label="Soon" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
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
            onFeedback?.('Account card saved.');
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
      onError?.(formatApiError(e, 'Could not start card setup'));
      setAddingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm" style={{ color: ui.textMuted }}>
        Loading…
      </div>
    );
  }

  if (settings?.gatewayMode !== 'own_payhere') {
    return null;
  }

  const billingActive = settings?.billing.status === 'active';
  const cardMutedStyle = cardMutedStyleFor(ui);

  return (
    <div className="rounded-2xl border p-4" style={cardMutedStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold" style={{ color: ui.text }}>
            Account card
          </p>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Optional when using your own gateway. Keep a card on file for your organizer account.
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
            {addingCard ? 'Opening secure card form…' : billingActive ? 'Update account card' : 'Add account card'}
          </FlowButton>
        </div>
      ) : null}
    </div>
  );
};
