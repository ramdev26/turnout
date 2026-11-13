import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Event, Ticket } from '../types';
import { LandingPulsePage } from '../components/landing/LandingPulse';
import { landingCssVars } from '../themes/eventThemes';

/**
 * Local-only preview for Pulse / Ctrl ticket-focused landing.
 * Visit /dev/pulse-preview?theme=pulse or ?theme=ctrl
 */
export const DevPulsePreview: React.FC = () => {
  const [params] = useSearchParams();
  const theme = params.get('theme') === 'ctrl' ? 'ctrl' : 'pulse';
  const isCtrl = theme === 'ctrl';
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({});

  const event = useMemo<Event>(
    () => ({
      id: isCtrl ? 'preview-ctrl' : 'preview-pulse',
      slug: isCtrl ? 'club-ctrl-preview' : 'take-my-bass-preview',
      organizerId: '1',
      title: isCtrl ? 'Club CTRL' : 'Take My Bass',
      description: 'Preview description — should not appear as THE STORY anymore.',
      date: '2026-12-05T17:30:00.000Z',
      location: 'Venue to be announced',
      bannerUrl: '',
      templateId: isCtrl ? 'template-12' : 'template-11',
      status: 'published',
      createdAt: new Date().toISOString(),
      customization: {
        heroText: isCtrl ? 'Club CTRL' : 'Take My Bass',
        heroSubtext: isCtrl ? 'DARK. INDUSTRIAL. HEAVY.' : 'GROOVY. BOUNCY. BASSY.',
        layout: 'standard',
        primaryColor: isCtrl ? '#e8342a' : '#ff2d8f',
        buttonColor: isCtrl ? '#e8342a' : '#ff2d8f',
        locationTba: true,
        pulseVenueNote: '',
        pulseTagline: isCtrl ? 'DARK. INDUSTRIAL. HEAVY.' : 'GROOVY. BOUNCY. BASSY.',
        pulseHeaderLinkLabel: isCtrl ? 'Access Take My Bass' : 'Access Club Ctrl',
        pulseHeaderLink: isCtrl ? '/tmb' : '/cc',
      },
    }),
    [isCtrl]
  );

  const tickets = useMemo<Ticket[]>(
    () => [
      {
        id: '2',
        eventId: event.id,
        name: 'Both Rooms (Early bird)',
        price: 3500,
        quantity: 80,
        sold: 8,
      },
      {
        id: '1',
        eventId: event.id,
        name: isCtrl ? 'Club Ctrl (Early bird)' : 'Take My Bass (Early bird)',
        price: 2500,
        quantity: 100,
        sold: 12,
      },
    ],
    [event.id, isCtrl]
  );

  const totalAmount = tickets.reduce(
    (sum, t) => sum + t.price * (selectedTickets[t.id] || 0),
    0
  );

  return (
    <div style={landingCssVars(event.customization, event.templateId)}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 80,
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          padding: '0.65rem 1rem',
          background: '#111',
          color: '#fff',
          fontSize: '0.85rem',
          borderBottom: '1px solid #333',
        }}
      >
        <strong>Local preview</strong>
        <span style={{ opacity: 0.7 }}>ticket-focused Pulse/Ctrl</span>
        <Link to="/dev/pulse-preview?theme=pulse" style={{ color: '#ff2d8f', fontWeight: 700 }}>
          Pulse
        </Link>
        <Link to="/dev/pulse-preview?theme=ctrl" style={{ color: '#e8342a', fontWeight: 700 }}>
          Ctrl
        </Link>
      </div>
      <LandingPulsePage
        event={event}
        tickets={tickets}
        selectedTickets={selectedTickets}
        onTicketChange={(id, qty) => setSelectedTickets((prev) => ({ ...prev, [id]: qty }))}
        totalAmount={totalAmount}
        onCheckout={() => undefined}
        isPurchasing={false}
      />
    </div>
  );
};
