import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatApiError } from '../utils/apiError';
import {
  PayHereInitiateResponse,
  startPayHereCheckout,
} from '../lib/payhereCheckout';
import '../styles/order-confirmation.css';

/**
 * Starts PayHere on the platform origin (APP_BASE_URL) after a custom-domain hop.
 * PayHere merchant secrets are domain-bound — checkout from tickets.* would return PH-0013.
 */
export const PayHereLaunch: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order_id') || '';
  const accessToken = params.get('token') || '';
  const returnOrigin = (params.get('return_origin') || '').replace(/\/$/, '');
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!orderId || !accessToken) {
      setStarting(false);
      setError('Missing checkout session. Go back to the event and try again.');
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const qs = new URLSearchParams({ token: accessToken });
        if (returnOrigin && /^https:\/\//i.test(returnOrigin)) {
          qs.set('return_origin', returnOrigin);
        }
        const res = await api.get<PayHereInitiateResponse>(
          `/api/payhere/checkout/${encodeURIComponent(orderId)}?${qs.toString()}`
        );
        if (cancelled) return;

        await startPayHereCheckout(res, {
          allowSameTabFallback: true,
          onCompleted: async (paidOrderId) => {
            const id = paidOrderId || orderId;
            const tokenQs = `?token=${encodeURIComponent(accessToken)}`;
            const successPath = `/orders/${id}/success${tokenQs}`;
            if (returnOrigin && /^https:\/\//i.test(returnOrigin)) {
              window.location.assign(`${returnOrigin}${successPath}`);
              return;
            }
            window.location.assign(successPath);
          },
          onDismissed: () => {
            const cancelPath = `/payhere/cancel?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(accessToken)}`;
            if (returnOrigin && /^https:\/\//i.test(returnOrigin)) {
              window.location.assign(`${returnOrigin}${cancelPath}`);
              return;
            }
            window.location.assign(cancelPath);
          },
          onError: (message) => {
            setStarting(false);
            setError(message || 'Could not open PayHere. Try again from the event page.');
          },
        });
      } catch (e: unknown) {
        if (cancelled) return;
        setStarting(false);
        setError(formatApiError(e, 'Could not resume checkout. Go back to the event and try again.'));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [orderId, accessToken, returnOrigin]);

  return (
    <div className="confirm-page confirm-loading">
      <div style={{ maxWidth: 380, width: '100%' }}>
        {starting && !error ? <div className="confirm-spinner" style={{ margin: '0 auto' }} /> : null}
        <h1 className="confirm-title" style={{ marginTop: '1rem' }}>
          {error ? 'Payment could not start' : 'Opening secure payment…'}
        </h1>
        <p className="confirm-sub">
          {error || 'Keep this page open. You will return to your tickets after paying.'}
        </p>
        {orderId ? <p className="confirm-hint">Booking #{orderId}</p> : null}
        <div style={{ marginTop: '1.35rem', display: 'grid', gap: '0.5rem' }}>
          {error ? (
            <button type="button" className="confirm-btn confirm-btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          ) : null}
          {returnOrigin ? (
            <a href={returnOrigin} className="confirm-btn confirm-btn-secondary">
              Back to event
            </a>
          ) : (
            <Link to="/" className="confirm-btn confirm-btn-secondary">
              Go home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
