import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Landmark, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import {
  OrganizerBillingPreapproveResponse,
  OrganizerGatewayMode,
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

export const OrganizerPaymentSettingsPanel: React.FC<Props> = ({ isOwner, onFeedback, onError }) => {
  const ui = APP_FLOW_UI;
  const fieldClass = fieldClassFor(ui);
  const fieldStyle = fieldStyleFor(ui);
  const cardMutedStyle = cardMutedStyleFor(ui);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [settings, setSettings] = useState<OrganizerPaymentSettings | null>(null);
  const [gatewayMode, setGatewayMode] = useState<OrganizerGatewayMode>('turnout');
  const [merchantId, setMerchantId] = useState('');
  const [merchantSecret, setMerchantSecret] = useState('');

  const loadSettings = useCallback(async () => {
    const res = await api.get<{ settings: OrganizerPaymentSettings }>('/api/organizer/payment-settings');
    setSettings(res.settings);
    setGatewayMode(res.settings.gatewayMode);
    setMerchantId(res.settings.ownPayhereMerchantId || '');
    setMerchantSecret('');
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadSettings();
      } catch (e: unknown) {
        onError?.(formatApiError(e, 'Failed to load payment settings'));
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
      const res = await api.post<{ settings: OrganizerPaymentSettings }>('/api/organizer/payment-settings', body);
      setSettings(res.settings);
      setMerchantSecret('');
      onFeedback?.('Payment settings saved.');
    } catch (e: unknown) {
      onError?.(formatApiError(e, 'Failed to save payment settings'));
    } finally {
      setSaving(false);
    }
  };

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
            onFeedback?.('Billing card saved. Turnout can collect platform fees from this card.');
          } else {
            onError?.('Card setup did not complete. Try again.');
          }
          setAddingCard(false);
        },
        onDismissed: () => {
          setAddingCard(false);
        },
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
        Loading payment settings…
      </div>
    );
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
            Use our built-in PayHere gateway. Add a billing card so we can collect the {commissionPct}% platform fee and
            ticket commission from your account.
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
            Connect your own PayHere merchant ID and secret. Ticket payments go directly to your PayHere account.
          </p>
        </button>
      </div>

      {gatewayMode === 'turnout' ? (
        <div className="rounded-2xl border p-4" style={cardMutedStyle}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold" style={{ color: ui.text }}>
                Billing card for platform fees
              </p>
              <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
                Required before you can sell paid tickets with Turnout Pay. We use PayHere to securely tokenize your card
                for commission collection.
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

          {settings?.requirements.needsBillingCard ? (
            <div className="mt-4">
              <FlowAlert variant="info">Add a billing card to enable paid ticket sales with Turnout Pay.</FlowAlert>
            </div>
          ) : null}
        </div>
      ) : (
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
        </div>
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
