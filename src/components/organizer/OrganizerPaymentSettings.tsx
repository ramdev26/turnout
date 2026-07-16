import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Landmark, ShieldCheck } from 'lucide-react';
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
import { cardMutedStyleFor, fieldClassFor, fieldStyleFor } from '../../themes/flowUi';

type Props = {
  isOwner: boolean;
  onFeedback?: (message: string) => void;
  onError?: (message: string) => void;
};

function BillingCardSection({
  isOwner,
  billingActive,
  settings,
  addingCard,
  onAddCard,
  commissionPct,
}: {
  isOwner: boolean;
  billingActive: boolean;
  settings: OrganizerPaymentSettings | null;
  addingCard: boolean;
  onAddCard: () => void;
  commissionPct: number;
}) {
  const ui = APP_FLOW_UI;
  const cardMutedStyle = cardMutedStyleFor(ui);

  return (
    <div className="rounded-2xl border p-4" style={cardMutedStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold" style={{ color: ui.text }}>
            Billing card for platform fees
          </p>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            Ticket sales go to your PayHere account, so Turnout cannot deduct the {commissionPct}% platform fee
            automatically. Add a card on file so we can charge commissions.
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
          <FlowButton onClick={onAddCard} disabled={addingCard}>
            {addingCard ? 'Opening secure card form…' : billingActive ? 'Update billing card' : 'Add billing card'}
          </FlowButton>
        </div>
      ) : null}

      {settings?.requirements.needsBillingCard ? (
        <div className="mt-4">
          <FlowAlert variant="info">
            Billing card is optional. Add one later from the separate Billing section if you want automatic fee collection.
          </FlowAlert>
        </div>
      ) : null}
    </div>
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
  const [merchantId, setMerchantId] = useState('');
  const [merchantSecret, setMerchantSecret] = useState('');
  const [bankAccountHolderName, setBankAccountHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [readiness, setReadiness] = useState<OrganizerPaidEventReadiness | null>(null);

  const loadSettings = useCallback(async () => {
    const res = await api.get<{ settings: OrganizerPaymentSettings; readiness: OrganizerPaidEventReadiness }>(
      '/api/organizer/payment-settings'
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

  const saveGatewaySettings = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { gatewayMode };
      if (gatewayMode === 'own_payhere') {
        body.ownPayhereMerchantId = merchantId.trim();
        if (merchantSecret.trim()) {
          body.ownPayhereMerchantSecret = merchantSecret.trim();
        }
      }
      if (gatewayMode === 'turnout') {
        body.bankAccountHolderName = bankAccountHolderName.trim();
        body.bankName = bankName.trim();
        body.bankBranch = bankBranch.trim();
        if (bankAccountNumber.trim()) {
          body.bankAccountNumber = bankAccountNumber.trim();
        }
      }
      const res = await api.post<{
        settings: OrganizerPaymentSettings;
        readiness: OrganizerPaidEventReadiness;
      }>('/api/organizer/payment-settings', body);
      setSettings(res.settings);
      setReadiness(res.readiness);
      setMerchantSecret('');
      setBankAccountNumber('');
      onFeedback?.('Payment settings saved.');
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Failed to save payment settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-sm" style={{ color: ui.textMuted }}>
        Loading payment settings…
      </div>
    );
  }

  if (loadError) {
    return <FlowAlert variant="error">{loadError}</FlowAlert>;
  }

  const commissionPct = settings?.commissionPct ?? 10;
  const billingActive = settings?.billing.status === 'active';

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!isOwner}
          onClick={() => setGatewayMode('turnout')}
          className="rounded-2xl border p-4 text-left transition"
          style={{
            ...cardMutedStyle,
            borderColor: gatewayMode === 'turnout' ? ui.accent : ui.borderColor,
            boxShadow: gatewayMode === 'turnout' ? `0 0 0 1px ${ui.accent}` : undefined,
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: ui.text }}>
            <ShieldCheck className="h-4 w-4" style={{ color: ui.accent }} />
            Turnout Pay
          </div>
          <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
            Use our built-in PayHere gateway. We collect ticket payments, deduct the {commissionPct}% platform fee,
            and send your earnings as a payout. No billing card needed.
          </p>
        </button>

        <button
          type="button"
          disabled={!isOwner}
          onClick={() => setGatewayMode('own_payhere')}
          className="rounded-2xl border p-4 text-left transition"
          style={{
            ...cardMutedStyle,
            borderColor: gatewayMode === 'own_payhere' ? ui.accent : ui.borderColor,
            boxShadow: gatewayMode === 'own_payhere' ? `0 0 0 1px ${ui.accent}` : undefined,
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ color: ui.text }}>
            <Landmark className="h-4 w-4" style={{ color: ui.accent }} />
            Your PayHere account
          </div>
          <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
            Connect your PayHere merchant ID and secret. Ticket payments go directly to you. Billing card setup is optional and available in a separate section.
          </p>
        </button>
      </div>

      {gatewayMode === 'turnout' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border p-4" style={cardMutedStyle}>
            <p className="font-semibold" style={{ color: ui.text }}>
              How Turnout Pay works
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: ui.textMuted }}>
              <li>Attendees pay through Turnout&apos;s PayHere account.</li>
              <li>Platform fees are deducted from each sale automatically.</li>
              <li>Your net earnings are paid out to your bank account.</li>
            </ul>
          </div>

          <div className="rounded-2xl border p-4" style={cardMutedStyle}>
            <p className="font-semibold" style={{ color: ui.text }}>
              Bank account for payouts
            </p>
            <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
              Required before your first paid event when using Turnout Pay.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <FlowLabel>Account holder name</FlowLabel>
                <FlowInput
                  value={bankAccountHolderName}
                  disabled={!isOwner}
                  onChange={(e) => setBankAccountHolderName(e.target.value)}
                  placeholder="Name as shown on bank account"
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
                  placeholder="e.g. Commercial Bank"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <FlowLabel>Branch</FlowLabel>
                <FlowInput
                  value={bankBranch}
                  disabled={!isOwner}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="Branch name or code"
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
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
              {settings?.ownPayhereSecretConfigured ? (
                <p className="text-xs" style={{ color: ui.textMuted }}>
                  Secret is saved. Leave blank to keep the current secret.
                </p>
              ) : null}
            </label>
          </div>        </div>
      )}

      {isOwner ? (
        <FlowButton onClick={saveGatewaySettings} disabled={saving}>
          {saving ? 'Saving…' : 'Save payment settings'}
        </FlowButton>
      ) : (
        <p className="text-sm" style={{ color: ui.textMuted }}>
          Only the workspace owner can change payment settings.
        </p>
      )}
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
      '/api/organizer/payment-settings'
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
        Loading billing settings…
      </div>
    );
  }

  const commissionPct = settings?.commissionPct ?? 10;
  const billingActive = settings?.billing.status === 'active';

  return (
    <BillingCardSection
      isOwner={isOwner}
      billingActive={billingActive}
      settings={settings}
      addingCard={addingCard}
      onAddCard={addBillingCard}
      commissionPct={commissionPct}
    />
  );
};
