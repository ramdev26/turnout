import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { notifyPayHereOpener } from '../lib/payhereCheckout';
import { Order } from '../types';
import { EVENT_THEMES } from '../themes/eventThemes';
import { accentButtonStyleFor, cardStyleFor } from '../themes/flowUi';

const ui = EVENT_THEMES.minimal.ui;

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
      setMsg('Missing order_id');
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
          setMsg('Payment failed or cancelled.');
          return;
        }
        setStatus('pending');
        setMsg('Payment is being confirmed. Please wait…');
      } catch {
        if (cancelled) return;
        setStatus('pending');
        setMsg('Waiting for payment confirmation…');
      }

      if (tries < 20 && !cancelled) {
        window.setTimeout(tick, 1500);
      } else if (!cancelled) {
        setStatus('pending');
        setMsg('Still confirming payment. You can refresh this page.');
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [navigate, orderId, accessToken]);

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12"
      style={{ background: ui.pageBg }}
    >
      <div className="w-full max-w-md">
        <div className="rounded-2xl border p-8 shadow-sm text-center" style={cardStyleFor(ui)}>
          {status === 'loading' || status === 'pending' ? (
            <Loader2 className="mx-auto h-12 w-12 animate-spin" style={{ color: ui.accent }} />
          ) : null}
          <h1 className="mt-4 text-2xl font-semibold" style={{ color: ui.text }}>
            {status === 'failed' ? 'Payment failed' : 'Confirming payment…'}
          </h1>
          <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
            {msg || 'Loading…'}
          </p>
          <div className="mt-2 text-xs font-mono" style={{ color: ui.textMuted }}>
            Order: {orderId || '—'} · Status: {status}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
              style={{ ...cardStyleFor(ui), color: ui.text }}
            >
              Refresh
            </button>
            <Link
              to="/"
              className="turnout-btn-accent rounded-xl px-5 py-2.5 text-sm font-semibold"
              style={accentButtonStyleFor(ui)}
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
