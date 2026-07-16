import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Building2, Landmark, ShieldCheck } from 'lucide-react';
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
  title = 'Set up paid events before you continue',
  onDismiss,
}) => {
  const ui = APP_FLOW_UI;

  if (!readiness || readiness.isReady) return null;

  const { requirements, gatewayMode } = readiness;
  const businessDone = !requirements.needsBusinessDetails;
  const bankDone = !requirements.needsBankDetails;
  const payhereDone = !requirements.needsOwnPayhereCredentials;

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
            Free events can go live right away. Before your first paid event, complete the setup below in Organization
            settings.
          </p>

          <div className="mt-4 space-y-2">
            <RequirementRow
              done={businessDone}
              icon={<Building2 className="h-4 w-4" />}
              label="Business details"
              detail="Organization name, business address, phone number, and BR document."
            />

            {gatewayMode === 'turnout' ? (
              <RequirementRow
                done={bankDone}
                icon={<Landmark className="h-4 w-4" />}
                label="Bank account for payouts"
                  detail="Account holder name, bank, branch, account number, and latest bank statement."
              />
            ) : (
              <>
                <RequirementRow
                  done={payhereDone}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="PayHere credentials"
                  detail="Your PayHere merchant ID and secret so ticket payments go to your account."
                />
              </>
            )}
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

          {gatewayMode === 'turnout' ? (
            <div className="mt-4">
              <FlowAlert variant="info">
                With Turnout Pay, attendees pay through us. We deduct platform fees and pay your net earnings to the
                bank account you provide.
              </FlowAlert>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
