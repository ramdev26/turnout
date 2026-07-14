import React, { useEffect } from 'react';

/**
 * Marketing page is served as static HTML (`public/turnout-landing.html`).
 * - Production (Vercel): `/landing` rewrites to that file (see vercel.json).
 * - Dev: Vite middleware serves it at `/landing`.
 */
export const MarketingLanding: React.FC = () => {
  useEffect(() => {
    const target = import.meta.env.DEV ? '/turnout-landing.html' : '/landing';
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
