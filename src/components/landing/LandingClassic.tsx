import React from 'react';
import type { LandingTemplateProps } from '../../templates/templates';
import {
  AboutBlock,
  CheckoutPanel,
  CountdownDisplay,
  EventBanner,
  EventGalleryStrip,
  EventMeta,
  HeroSubtitle,
  HeroTitle,
  LandingPageShell,
  LandingTopBar,
  PremiumBadge,
  TicketsList,
  TicketsSection,
  themeDisplayName,
} from './LandingShared';

function landingHeroSubtitle(event: LandingTemplateProps['event']): string {
  return (event.customization?.heroSubtext || event.description || '').trim();
}

export function LandingClassicPage(props: LandingTemplateProps) {
  const { event, tickets, selectedTickets, onTicketChange, totalAmount, onCheckout, isPurchasing } = props;
  const subtitle = landingHeroSubtitle(event);
  const hasBanner = !!event.bannerUrl?.trim();

  return (
    <LandingPageShell event={event}>
      <LandingTopBar event={event} onGetTickets={onCheckout} />

      <main className="landing-classic-main mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:max-w-4xl lg:pb-20">
        {hasBanner ? (
          <div className="landing-poster-frame landing-poster-frame--hero landing-poster-frame--showcase landing-poster-frame--classic mx-auto">
            <EventBanner event={event} overlay="none" imageClassName="landing-poster-img" />
          </div>
        ) : null}
        <EventGalleryStrip event={event} className="mx-auto max-w-3xl" />

        <div className={`text-center ${hasBanner ? 'mt-8' : 'mt-2'}`}>
          <PremiumBadge>{themeDisplayName(event)}</PremiumBadge>
          <HeroTitle className="mt-5">{event.customization?.heroText || event.title}</HeroTitle>
          {subtitle ? <HeroSubtitle>{subtitle}</HeroSubtitle> : null}
        </div>

        <div className="mt-8 flex justify-center">
          <EventMeta event={event} className="landing-classic-meta !mt-0" />
        </div>

        <div className="mt-10">
          <CountdownDisplay targetIso={event.date} tba={!!event.customization?.scheduleTba} />
        </div>

        <div className="mt-12">
          <AboutBlock event={event} />
        </div>

        <div id="landing-tickets" className="mt-14 scroll-mt-24">
          <TicketsSection>
            <TicketsList
              tickets={tickets}
              selectedTickets={selectedTickets}
              onTicketChange={onTicketChange}
            />
          </TicketsSection>
        </div>

        <div className="mt-8">
          <CheckoutPanel
            tickets={tickets}
            selectedTickets={selectedTickets}
            totalAmount={totalAmount}
            onCheckout={onCheckout}
            isPurchasing={isPurchasing}
          />
        </div>
      </main>
    </LandingPageShell>
  );
}
