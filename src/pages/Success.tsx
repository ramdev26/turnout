import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Order, Event } from '../types';
import { CheckCircle, Calendar, MapPin, Ticket, ArrowRight, Download, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { api } from '../api/client';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { useAuthStore } from '../store/useAuthStore';
import { TURNOUT_BRAND } from '../themes/brandColors';

type TicketPdfTemplate = 'classic' | 'midnight' | 'sunset';

const hexToRgb = (hex: string, fallback: [number, number, number]): [number, number, number] => {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '';
  if (!safeHex) return fallback;
  const n = parseInt(safeHex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const cardShell =
  'rounded-2xl border backdrop-blur-md';
const cardShellStyle: React.CSSProperties = {
  borderColor: TURNOUT_BRAND.limeLine,
  background: 'rgba(255, 255, 255, 0.05)',
  boxShadow: '0 12px 36px rgba(5, 46, 48, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
};

export const Success: React.FC = () => {
  const { user } = useAuthStore();
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token') || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) return;
      try {
        const tokenQs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
        const orderRes = await api.get<{ order: Order }>(`/api/orders/${orderId}${tokenQs}`);
        setOrder(orderRes.order);

        const eventRes = await api.get<{ event: Event }>(`/api/events/${orderRes.order.eventId}`);
        setEvent(eventRes.event);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, accessToken]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-t-[var(--primary)]"
          style={{ borderColor: TURNOUT_BRAND.limeLine, borderTopColor: 'var(--primary)' }}
        />
      </div>
    );
  }

  if (!order || !event) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--text)]">Order not found</h2>
        <p className="mt-2 text-[var(--text-muted)]">We couldn&apos;t find your order details.</p>
        <Link to="/" className="mt-6 font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  const downloadAttendeeTicket = (attendee: { id: string; fullName: string; email: string; qrToken: string }) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    const eventDate = format(new Date(event.date), 'PPPP p');
    const template = (event.customization?.ticketPdfTemplateId || 'classic') as TicketPdfTemplate;
    const primaryRgb = hexToRgb(event.customization?.ticketPdfPrimaryColor || '#4f46e5', [79, 70, 229]);
    const accentRgb = hexToRgb(event.customization?.ticketPdfAccentColor || '#10b981', [16, 185, 129]);
    const badgeText = event.customization?.ticketPdfBadgeText || 'VIP ACCESS';
    const footerNote = event.customization?.ticketPdfFooterNote || 'Please bring this ticket and a valid ID.';
    const darkText: [number, number, number] = template === 'midnight' ? [229, 231, 235] : [17, 24, 39];
    const bodyBg: [number, number, number] = template === 'midnight' ? [17, 24, 39] : [255, 255, 255];
    const bodyBorder: [number, number, number] = template === 'midnight' ? [55, 65, 81] : [229, 231, 235];
    const panelBg: [number, number, number] = template === 'midnight' ? [31, 41, 55] : [249, 250, 251];

    if (template === 'sunset') {
      doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.roundedRect(margin, margin, pageWidth - margin * 2, 90, 14, 14, 'F');
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.roundedRect(margin + 24, margin + 10, pageWidth - margin * 2 - 48, 70, 12, 12, 'F');
    } else {
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.roundedRect(margin, margin, pageWidth - margin * 2, 90, 14, 14, 'F');
    }

    if (template === 'midnight') {
      doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.circle(pageWidth - margin - 38, margin + 28, 8, 'F');
      doc.circle(pageWidth - margin - 22, margin + 28, 4, 'F');
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(event.title, margin + 18, margin + 36, { maxWidth: pageWidth - margin * 2 - 36 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Order #${order.id}  •  Turnout E-Ticket`, margin + 18, margin + 62);
    doc.setFontSize(10);
    doc.text(badgeText.toUpperCase(), margin + 18, margin + 78);

    doc.setDrawColor(bodyBorder[0], bodyBorder[1], bodyBorder[2]);
    doc.setFillColor(bodyBg[0], bodyBg[1], bodyBg[2]);
    doc.roundedRect(margin, margin + 105, pageWidth - margin * 2, 360, 14, 14, 'FD');

    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Attendee', margin + 20, margin + 135);
    doc.text('Email', margin + 20, margin + 180);
    doc.text('Date & Time', margin + 20, margin + 225);
    doc.text('Location', margin + 20, margin + 270);
    doc.text('Entry Token', margin + 20, margin + 315);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.text(attendee.fullName, margin + 20, margin + 153, { maxWidth: 300 });
    doc.text(attendee.email, margin + 20, margin + 198, { maxWidth: 300 });
    doc.text(eventDate, margin + 20, margin + 243, { maxWidth: 300 });
    doc.text(event.location, margin + 20, margin + 288, { maxWidth: 300 });

    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.roundedRect(margin + 20, margin + 326, 300, 30, 8, 8, 'F');
    doc.setTextColor(243, 244, 246);
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.text(attendee.qrToken, margin + 30, margin + 346, { maxWidth: 280 });

    const qrCanvas = document.getElementById(`ticket-qr-${attendee.id}`) as HTMLCanvasElement | null;
    if (qrCanvas) {
      const qrData = qrCanvas.toDataURL('image/png');
      doc.setFillColor(panelBg[0], panelBg[1], panelBg[2]);
      doc.setDrawColor(bodyBorder[0], bodyBorder[1], bodyBorder[2]);
      doc.roundedRect(pageWidth - margin - 190, margin + 135, 170, 220, 12, 12, 'FD');
      doc.addImage(qrData, 'PNG', pageWidth - margin - 170, margin + 155, 130, 130);
      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Scan at check-in gate', pageWidth - margin - 105, margin + 305, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Present this PDF to staff', pageWidth - margin - 105, margin + 322, { align: 'center' });
    }

    const mutedText: [number, number, number] = template === 'midnight' ? [156, 163, 175] : [107, 114, 128];
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(footerNote, margin, margin + 500, { maxWidth: pageWidth - margin * 2 });

    const safeName = attendee.fullName.replace(/[^a-zA-Z0-9-_]+/g, '_');
    doc.save(`ticket_${order.id}_${safeName || 'attendee'}.pdf`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-3xl border backdrop-blur-xl"
        style={{
          borderColor: TURNOUT_BRAND.limeLine,
          background: 'rgba(5, 46, 48, 0.55)',
          boxShadow: '0 24px 56px rgba(5, 46, 48, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          className="pointer-events-none h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${TURNOUT_BRAND.lime500}, ${TURNOUT_BRAND.teal600})` }}
        />

        <div className="flex flex-col items-center gap-6 px-6 py-10 text-center sm:px-10 sm:py-12">
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-full sm:h-24 sm:w-24"
            style={{
              background: TURNOUT_BRAND.limeSoft,
              boxShadow: `0 0 0 1px ${TURNOUT_BRAND.limeLine}, 0 12px 32px rgba(192, 255, 114, 0.2)`,
            }}
          >
            <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12" style={{ color: TURNOUT_BRAND.lime500 }} strokeWidth={2} />
          </div>

          <div>
            <p
              className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ background: TURNOUT_BRAND.limeSoft, color: TURNOUT_BRAND.lime400 }}
            >
              <Sparkles className="h-3 w-3" />
              Payment complete
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">Order confirmed</h1>
            <p className="mx-auto mt-3 max-w-md text-base text-[var(--text-muted)] sm:text-lg">
              Thank you for your purchase. Your tickets are ready — show the QR codes below at the door.
            </p>
          </div>
        </div>

        <div className="border-t px-6 pb-8 sm:px-10 sm:pb-10" style={{ borderColor: TURNOUT_BRAND.limeLine }}>
          <div className={`${cardShell} p-6 sm:p-8`} style={cardShellStyle}>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{event.title}</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm text-[var(--text-muted)] sm:text-base">
              <div className="flex items-start gap-2.5">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                {format(new Date(event.date), 'PPPP p')}
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                {event.location}
              </div>
            </div>

            <div className="mt-8 border-t pt-6" style={{ borderColor: TURNOUT_BRAND.limeLine }}>
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-subtle)]">Your tickets</h3>
              <div className="mt-4 flex flex-col gap-3">
                {order.tickets.map((t, i) => (
                  <div
                    key={i}
                    className={`${cardShell} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
                    style={{
                      ...cardShellStyle,
                      background: 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: TURNOUT_BRAND.limeSoft, color: TURNOUT_BRAND.lime500 }}
                      >
                        <Ticket className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text)]">{t.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">Quantity: {t.quantity}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-subtle)] sm:text-sm">
                      <Download className="h-4 w-4 text-[var(--primary)]" />
                      Download each pass below
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {order.attendees && order.attendees.length > 0 && (
              <div className="mt-8 border-t pt-6" style={{ borderColor: TURNOUT_BRAND.limeLine }}>
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                  Check-in QR codes
                </h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Present these at the entrance. Staff will scan to check you in.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {order.attendees.map((a) => (
                    <div key={a.id} className={`${cardShell} flex flex-col items-center gap-4 p-5`} style={cardShellStyle}>
                      <div
                        className="rounded-xl border p-3"
                        style={{
                          borderColor: TURNOUT_BRAND.limeLine,
                          background: TURNOUT_BRAND.cream,
                          boxShadow: 'inset 0 0 0 1px rgba(10, 36, 38, 0.06)',
                        }}
                      >
                        <QRCodeCanvas
                          id={`ticket-qr-${a.id}`}
                          value={a.qrToken}
                          size={152}
                          bgColor={TURNOUT_BRAND.cream}
                          fgColor={TURNOUT_BRAND.ink}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                      <div className="w-full text-center">
                        <div className="text-sm font-semibold text-[var(--text)]">{a.fullName}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{a.email}</div>
                      </div>
                      <div
                        className="w-full rounded-xl border px-3 py-2.5 font-mono text-[10px] leading-relaxed break-all sm:text-[11px]"
                        style={{
                          borderColor: TURNOUT_BRAND.limeLine,
                          background: TURNOUT_BRAND.teal900,
                          color: TURNOUT_BRAND.lime300,
                        }}
                      >
                        {a.qrToken}
                      </div>
                      {a.checkedInAt ? (
                        <span
                          className="rounded-full px-3 py-1 text-xs font-bold"
                          style={{ background: TURNOUT_BRAND.limeSoft, color: TURNOUT_BRAND.lime500 }}
                        >
                          Checked in
                        </span>
                      ) : (
                        <span
                          className="rounded-full px-3 py-1 text-xs font-bold"
                          style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fcd34d' }}
                        >
                          Not checked in yet
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadAttendeeTicket(a)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:brightness-110"
                        style={{
                          borderColor: TURNOUT_BRAND.limeLine,
                          background: TURNOUT_BRAND.limeSoft,
                          color: TURNOUT_BRAND.lime500,
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Download ticket PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
            <Link
              to="/"
              className="flex flex-1 items-center justify-center rounded-xl border py-3.5 text-sm font-semibold transition hover:brightness-110 sm:py-4"
              style={{
                borderColor: TURNOUT_BRAND.limeLine,
                color: 'var(--text)',
                background: 'rgba(255, 255, 255, 0.04)',
              }}
            >
              Go to home
            </Link>
            <Link
              to={user?.role === 'attendee' ? '/attendee/dashboard' : '/dashboard'}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition hover:brightness-105 sm:py-4"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-on)',
                boxShadow: '0 8px 24px rgba(192, 255, 114, 0.25)',
              }}
            >
              {user?.role === 'attendee' ? 'Go to my events' : 'Go to dashboard'}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
