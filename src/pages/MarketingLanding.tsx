import React, { useEffect } from 'react';

/**
 * Marketing home is served as static HTML (`public/turnout-landing.html`).
 * - Production (Vercel): `/` rewrites to that file (see vercel.json).
 * - Dev: Vite middleware serves it at `/`.
 * - In-app navigation to `/` triggers a full reload so we never rely on an iframe.
 */
export const MarketingLanding: React.FC = () => {
  useEffect(() => {
    const target = import.meta.env.DEV ? '/turnout-landing.html' : '/';
    window.location.replace(target);
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm font-medium"
      style={{ background: '#0D585B', color: '#E9F4EE' }}
    >
      Loading…
    </div>
  );
};
