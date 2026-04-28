import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export const PayHereCancel: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order_id') || '';

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-extrabold text-neutral-900">Payment cancelled</h1>
        <p className="mt-2 text-sm text-neutral-600">You cancelled the PayHere payment flow.</p>
        {orderId && (
          <p className="mt-3 text-xs text-neutral-500">
            Order: <span className="font-mono">{orderId}</span>
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <Link to="/" className="rounded-xl bg-[#00E676] px-4 py-2 text-sm font-bold text-[#062013] hover:bg-[#00C765]">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

