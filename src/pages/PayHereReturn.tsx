import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Order } from '../types';

export const PayHereReturn: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.get('order_id') || '';
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
        const res = await api.get<{ order: Order }>(`/api/orders/${orderId}`);
        const s = res.order.status;
        if (cancelled) return;
        if (s === 'paid') {
          setStatus('paid');
          navigate(`/orders/${orderId}/success`, { replace: true });
          return;
        }
        if (s === 'failed') {
          setStatus('failed');
          setMsg('Payment failed or cancelled.');
          return;
        }
        setStatus('pending');
        setMsg('Payment is being confirmed. Please wait…');
      } catch (e: any) {
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
  }, [navigate, orderId]);

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-neutral-900">PayHere return</h1>
        <p className="mt-2 text-sm text-neutral-600">{msg || 'Loading…'}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 hover:bg-neutral-50"
          >
            Refresh
          </button>
          <Link
            to="/"
            className="rounded-xl bg-[#00E676] px-4 py-2 text-sm font-bold text-[#062013] hover:bg-[#00C765]"
          >
            Go home
          </Link>
        </div>
        <div className="mt-4 text-xs text-neutral-500">
          Order: <span className="font-mono">{orderId || '—'}</span> • Status: <span className="font-mono">{status}</span>
        </div>
      </div>
    </div>
  );
};

