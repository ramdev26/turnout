import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Check, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { notifyPayHereOpener } from '../lib/payhereCheckout';
import { Order } from '../types';
import '../styles/order-confirmation.css';

export const PayHereReturn: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('order_id') || '';
  const accessToken = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'pending' | 'paid' | 'failed'>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setStatus('failed');
      setMsg('Missing order reference.');
      return;
    }

    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
        const statusPath = accessToken
          ? `/api/payhere/status/${orderId}${tokenQs}`
          : `/api/orders/${orderId}${tokenQs}`;
        const res = await api.get<{ order: Pick<Order, 'status'> | Order }>(statusPath);
        const s = res.order.status;
        if (cancelled) return;
        if (s === 'paid') {
          setStatus('paid');
          if (window.opener && !window.opener.closed) {
            notifyPayHereOpener({ type: 'payhere:completed', orderId });
            return;
          }
          navigate(`/orders/${orderId}/success${tokenQs}`, { replace: true });
          return;
        }
        if (s === 'failed') {
          setStatus('failed');
          setMsg('Payment failed or was cancelled.');
          return;
        }
        setStatus('pending');
        setMsg('Payment is being confirmed. This usually takes a few seconds…');
      } catch {
        if (cancelled) return;
        setStatus('pending');
        setMsg('Waiting for payment confirmation…');
      }

      if (tries < 20 && !cancelled) {
        window.setTimeout(tick, 1500);
      } else if (!cancelled) {
        setStatus('pending');
        setMsg('Still confirming payment. You can refresh this page or open your SMS ticket link.');
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [navigate, orderId, accessToken]);

  const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';

  return (
    <div className="confirm-page confirm-loading">
      <div style={{ maxWidth: 380, width: '100%' }}>
        {status === 'paid' ? (
          <div className="confirm-check" style={{ margin: '0 auto 1rem' }} aria-hidden>
            <Check className="h-8 w-8" strokeWidth={2.75} />
          </div>
        ) : status === 'failed' ? null : (
          <div className="confirm-spinner" style={{ margin: '0 auto' }} />
        )}

        <h1 className="confirm-title" style={{ marginTop: '1rem' }}>
          {status === 'failed' ? 'Payment not completed' : status === 'paid' ? 'Payment confirmed' : 'Confirming your order…'}
        </h1>
        <p className="confirm-sub">{msg || (status === 'paid' ? 'Taking you to your tickets…' : 'Please keep this page open.')}</p>
        {orderId ? <p className="confirm-hint">Booking #{orderId}</p> : null}

        <div style={{ marginTop: '1.35rem', display: 'grid', gap: '0.5rem' }}>
          {status === 'paid' && orderId ? (
            <Link to={`/orders/${orderId}/success${tokenQs}`} className="confirm-btn confirm-btn-primary">
              View tickets
            </Link>
          ) : (
            <button type="button" className="confirm-btn confirm-btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          )}
          <Link to="/" className="confirm-btn confirm-btn-secondary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
};
