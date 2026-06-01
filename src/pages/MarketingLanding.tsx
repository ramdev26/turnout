import React from 'react';

/** Full-screen marketing page from `public/turnout-landing.html` (no app chrome). */
export const MarketingLanding: React.FC = () => {
  return (
    <iframe
      src="/turnout-landing.html"
      title="Turnout"
      className="fixed inset-0 z-0 h-[100dvh] w-full border-0 bg-white"
    />
  );
};
