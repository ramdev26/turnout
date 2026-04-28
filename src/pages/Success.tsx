import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Order, Event } from '../types';
import { CheckCircle, Calendar, MapPin, Ticket, ArrowRight, Download } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { api } from '../api/client';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { useAuthStore } from '../store/useAuthStore';

type TicketPdfTemplate = 'classic' | 'midnight' | 'sunset';

const hexToRgb = (hex: string, fallback: [number, number, number]): [number, number, number] => {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '';
  if (!safeHex) return fallback;
  const n = parseInt(safeHex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const Success: React.FC = () => {
  const { user } = useAuthStore();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) return;
      try {
        const orderRes = await api.get<{ order: Order }>(`/api/orders/${orderId}`);
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
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00a95d] border-t-transparent" />
      </div>
    );
  }

  if (!order || !event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-3xl font-bold">Order not found</h2>
        <p className="mt-2 text-neutral-500">We couldn't find your order details.</p>
        <Link to="/" className="mt-6 font-semibold text-[#00a95d] underline">Go back home</Link>
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
    <div className="mx-auto max-w-4xl py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-8 rounded-3xl border border-indigo-100 bg-white p-8 text-center shadow-[0_18px_50px_rgba(30,41,59,0.12)] sm:p-12"
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
          <CheckCircle className="h-12 w-12" />
        </div>
        
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">Order Confirmed</h1>
          <p className="mt-3 text-lg text-neutral-600">
            Thank you for your purchase. Your tickets are ready!
          </p>
        </div>

        <div className="w-full rounded-2xl border border-[#00E676]/20 bg-gradient-to-b from-white to-[#ecfdf3] p-8 text-left">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">{event.title}</h2>
          <div className="mt-4 flex flex-col gap-3 text-neutral-500">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(new Date(event.date), 'PPPP p')}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {event.location}
            </div>
          </div>

          <div className="mt-8 border-t border-neutral-200 pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Your Tickets</h3>
            <div className="mt-4 flex flex-col gap-4">
              {order.tickets.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ecfdf3] text-[#00a95d]">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold">{t.name}</p>
                      <p className="text-xs text-neutral-500">Quantity: {t.quantity}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-medium text-neutral-400"
                    disabled
                    title="Use attendee ticket downloads below"
                  >
                    <Download className="h-4 w-4" />
                    Download below
                  </button>
                </div>
              ))}
            </div>
          </div>

          {order.attendees && order.attendees.length > 0 && (
            <div className="mt-8 border-t border-neutral-200 pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">QR Codes (for check-in)</h3>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                {order.attendees.map((a) => (
                  <div key={a.id} className="flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
                    <div className="rounded-lg border border-neutral-200 bg-white p-3">
                      <QRCodeCanvas
                        id={`ticket-qr-${a.id}`}
                        value={JSON.stringify({ eventId: order.eventId, qrToken: a.qrToken })}
                        size={112}
                        bgColor="#ffffff"
                        fgColor="#0a0a0a"
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-neutral-900">{a.fullName}</div>
                      <div className="mt-1 text-xs text-neutral-500">{a.email}</div>
                    </div>
                    <div className="w-full rounded-lg bg-neutral-900 p-2 font-mono text-[11px] text-neutral-200 break-all">
                      {a.qrToken}
                    </div>
                    {a.checkedInAt ? (
                      <div className="mt-1 text-xs font-bold text-emerald-700">Checked in</div>
                    ) : (
                      <div className="mt-1 text-xs font-bold text-amber-700">Not checked in</div>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadAttendeeTicket(a)}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[#00E676]/20 bg-[#ecfdf3] px-3 py-2 text-xs font-semibold text-[#008e4f] hover:bg-[#dcfce7]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Ticket
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 sm:flex-row">
          <Link to="/" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 py-4 font-semibold text-neutral-600 hover:bg-neutral-50">
            Go to Home
          </Link>
          <Link
            to={user?.role === 'attendee' ? '/attendee/dashboard' : '/dashboard'}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00E676] py-4 font-semibold text-[#062013] shadow-md transition-all hover:bg-[#00C765] hover:shadow-lg"
          >
            {user?.role === 'attendee' ? 'Go to My Events' : 'Go to Dashboard'}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
