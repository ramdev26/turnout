import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CreditCard, ShieldCheck } from 'lucide-react';
import { OrganizerPaidEventReadiness } from '../../types';
import { FlowAlert, FlowButton } from '../flow/FlowPrimitives';
import { APP_FLOW_UI } from '../flow/FlowPrimitives';
import { cardMutedStyleFor } from '../../themes/flowUi';

type Props = {
  readiness: OrganizerPaidEventReadiness | null;
  title?: string;
  onDismiss?: () => void;
};

function RequirementRow({
  done,
  icon,
  label,
  detail,
}: {
  done: boolean;
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  const ui = APP_FLOW_UI;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-4 py-3"
      style={{
        ...cardMutedStyleFor(ui),
        opacity: done ? 0.55 : 1,
      }}
    >
      <div
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={{ background: done ? ui.accentSoft : 'rgba(244, 63, 94, 0.12)', color: done ? ui.accent : '#e11d48' }}
      >
        {icon}
      </div>
      <div>
        <p className="font-semibold" style={{ color: ui.text }}>
          {label} {done ? '· complete' : '· required'}
        </p>
        <p className="mt-0.5 text-sm" style={{ color: ui.textMuted }}>
          {detail}
        </p>
      </div>
    </div>
  );
}

export const PaidEventSetupGate: React.FC<Props> = ({
  readiness,
  title = 'Finish your own gateway setup',
  onDismiss,
}) => {
  const ui = APP_FLOW_UI;

  // Turnout Pay can publish/sell immediately — only own-gateway setup can block.
  if (!readiness || readiness.isReady || readiness.gatewayMode === 'turnout') return null;

  const { requirements } = readiness;
  const payhereDone = !requirements.needsOwnPayhereCredentials;
  const billingDone = !requirements.needsBillingCard;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ ...cardMutedStyleFor(ui), borderColor: 'rgba(244, 63, 94, 0.25)' }}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold" style={{ color: ui.text }}>
            {title}
          </h3>
          <p className="mt-1 text-sm" style={{ color: ui.textMuted }}>
            You chose your own payment gateway. Connect credentials and an account card before selling paid tickets —
            or switch back to Turnout Pay in Organization → Payments to publish right away.
          </p>

          <div className="mt-4 space-y-2">
            <RequirementRow
              done={payhereDone}
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Your payment gateway"
              detail="Connect your merchant ID and secret for your own gateway."
            />
            <RequirementRow
              done={billingDone}
              icon={<CreditCard className="h-4 w-4" />}
              label="Account card"
              detail="Add an account card to finish your own-gateway setup."
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to={readiness.setupUrl || '/dashboard/organization'}>
              <FlowButton type="button">Go to Organization settings</FlowButton>
            </Link>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm font-semibold underline-offset-2 hover:underline"
                style={{ color: ui.textMuted }}
              >
                Stay on free tickets
              </button>
            ) : null}
          </div>

          <div className="mt-4">
            <FlowAlert variant="info">
              With Turnout Pay, you can publish paid events immediately — no bank details or documents required upfront.
              Add a bank account later when you want payouts.
            </FlowAlert>
          </div>
        </div>
      </div>
    </div>
  );
};
