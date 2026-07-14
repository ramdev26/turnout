import React from 'react';
import { Link } from 'react-router-dom';
import { EVENT_THEMES } from '../../themes/eventThemes';
import { cardStyleFor } from '../../themes/flowUi';
import { TurnoutLogo } from '../branding/TurnoutLogo';

const ui = EVENT_THEMES.minimal.ui;

export const AuthFlowLayout: React.FC<{ children: React.ReactNode; title?: string; subtitle?: string }> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <div
      className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-10 sm:px-6"
      style={{ background: ui.pageBg, color: ui.text }}
    >
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
        style={{ ...cardStyleFor(ui), color: ui.text }}
      >
        <TurnoutLogo className="h-5 w-auto" />
      </Link>
      <div className="w-full max-w-md">
        {(title || subtitle) && (
          <div className="mb-6 text-center sm:text-left">
            {title ? (
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: ui.text }}>
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mt-2 text-sm" style={{ color: ui.textMuted }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        )}
        <div className="rounded-2xl border p-6 shadow-sm sm:p-8" style={cardStyleFor(ui)}>
          {children}
        </div>
      </div>
    </div>
  );
};
