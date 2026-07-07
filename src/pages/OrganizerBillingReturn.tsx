import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { OrganizerPaymentSettings } from '../types';
import { AuthFlowLayout } from '../components/auth/AuthFlowLayout';
import { FlowAlert, FlowButton } from '../components/flow/FlowPrimitives';
import { formatApiError } from '../utils/apiError';

export const OrganizerBillingReturn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const setupOrderId = searchParams.get('setup_order_id') || '';
  const [message, setMessage] = useState('Confirming your billing card…');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!setupOrderId) {
      setError('Missing billing setup reference.');
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await api.get<{ sessionStatus: string; settings: OrganizerPaymentSettings }>(
          `/api/organizer/billing/status?setup_order_id=${encodeURIComponent(setupOrderId)}`
        );
        if (cancelled) return;
        if (res.settings.billing.status === 'active') {
          setMessage('Billing card saved successfully.');
          setDone(true);
          return;
        }
        if (res.sessionStatus === 'failed') {
          setError('Card setup failed. Return to Organization settings and try again.');
          return;
        }
        attempts += 1;
        if (attempts < 12) {
          window.setTimeout(poll, 1500);
        } else {
          setError('Still waiting for PayHere confirmation. Check Organization settings in a moment.');
        }
      } catch (e: unknown) {
        if (!cancelled) setError(formatApiError(e, 'Could not confirm billing card setup.'));
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [setupOrderId]);

  return (
    <AuthFlowLayout title="Billing card setup" subtitle="Turnout platform fees">
      {error ? <FlowAlert variant="error">{error}</FlowAlert> : <FlowAlert variant="success">{message}</FlowAlert>}
      <div className="mt-6">
        <Link to="/dashboard/organization">
          <FlowButton>{done ? 'Back to organization settings' : 'Open organization settings'}</FlowButton>
        </Link>
      </div>
    </AuthFlowLayout>
  );
};

export const OrganizerBillingCancel: React.FC = () => {
  return (
    <AuthFlowLayout title="Billing setup cancelled" subtitle="No card was saved">
      <FlowAlert variant="info">You can add a billing card anytime from Organization settings.</FlowAlert>
      <div className="mt-6">
        <Link to="/dashboard/organization">
          <FlowButton>Back to organization settings</FlowButton>
        </Link>
      </div>
    </AuthFlowLayout>
  );
};
