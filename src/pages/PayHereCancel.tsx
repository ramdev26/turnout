import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { EVENT_THEMES } from '../themes/eventThemes';
import { cardStyleFor } from '../themes/flowUi';

const ui = EVENT_THEMES.minimal.ui;

export const PayHereCancel: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order_id') || '';

  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12"
      style={{ background: ui.pageBg }}
    >
      <div className="w-full max-w-md">
        <div className="rounded-2xl border p-8 shadow-sm text-center" style={cardStyleFor(ui)}>
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: '#fee2e2' }}
          >
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold" style={{ color: ui.text }}>
            Payment cancelled
          </h1>
          <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
            Your payment was cancelled. No charge was made.
          </p>
          {orderId && (
            <p className="mt-3 text-xs" style={{ color: ui.textMuted }}>
              Order: <span className="font-mono">{orderId}</span>
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to="/"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: ui.accent }}
            >
              Back to home
            </Link>
            <Link
              to="/attendee/dashboard"
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
              style={{ ...cardStyleFor(ui), color: ui.text }}
            >
              My tickets
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
