import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Order, Event } from '../types';
import { Check, Calendar, MapPin, Download, UploadCloud, Landmark, Ticket, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { api, toApiUrl } from '../api/client';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { formatApiError } from '../utils/apiError';
import { formatLKRWhole } from '../utils/money';
import '../styles/order-confirmation.css';

type TicketPdfTemplate = 'classic' | 'midnight' | 'sunset';

const hexToRgb = (hex: string, fallback: [number, number, number]): [number, number, number] => {
  const safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '';
  if (!safeHex) return fallback;
  const n = parseInt(safeHex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const Success: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token') || '';
  const passId = searchParams.get('pass') || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [slipError, setSlipError] = useState<string | null>(null);
  const [slipFeedback, setSlipFeedback] = useState<string | null>(null);
  const slipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) return;
      setLoadError(null);
      try {
        const qs = new URLSearchParams();
        if (accessToken) qs.set('token', accessToken);
        if (passId) qs.set('pass', passId);
        const query = qs.toString();

        if (accessToken) {
          try {
            await api.get<{ order: { status: string } }>(`/api/payhere/status/${orderId}?token=${encodeURIComponent(accessToken)}`);
          } catch {
            // Non-fatal — GET order also syncs pending payments.
          }
        }

        const orderRes = await api.get<{ order: Order; event?: Event }>(
          `/api/orders/${orderId}${query ? `?${query}` : ''}`
        );
        let loaded = orderRes.order;
        if (passId && loaded.attendees?.length) {
          const mine = loaded.attendees.filter((a) => a.id === passId);
          if (mine.length > 0) {
            loaded = { ...loaded, attendees: mine, viewScope: 'attendee', tickets: [] };
          }
        }
        setOrder(loaded);

        if (orderRes.event) {
          setEvent(orderRes.event);
        } else {
          const eventRes = await api.get<{ event: Event }>(`/api/events/${orderRes.order.eventId}`);
          setEvent(eventRes.event);
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        const err = error as { error?: string; message?: string };
        if (err?.error === 'forbidden' || err?.error === 'missing_token') {
          setLoadError(
            formatApiError(
              error,
              'This confirmation link is invalid or expired. Open the link from your SMS or email.'
            )
          );
        } else if (err?.error === 'order_not_found') {
          setLoadError('We could not find an order with that number.');
        } else {
          setLoadError(formatApiError(error, 'We could not load your order. Check the link and try again.'));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, accessToken, passId]);

  const uploadSlip = async (file: File) => {
    if (!orderId || !order) return;
    setUploadingSlip(true);
    setSlipError(null);
    setSlipFeedback(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const qs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      const res = await fetch(toApiUrl(`/api/orders/${orderId}/bank-transfer-slip${qs}`), {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw Object.assign(new Error(data.message || data.error || 'Upload failed'), data);
      }
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              bankTransferSlipUrl: data.bankTransferSlipUrl || prev.bankTransferSlipUrl,
              bankTransferSlipUploadedAt: new Date().toISOString(),
            }
          : prev
      );
      setSlipFeedback('Transfer slip uploaded. The organizer will confirm your payment soon.');
    } catch (e: unknown) {
      setSlipError(formatApiError(e, 'Could not upload transfer slip. Try again.'));
    } finally {
      setUploadingSlip(false);
      if (slipInputRef.current) slipInputRef.current.value = '';
    }
  };

  const downloadAttendeeTicket = (attendee: { id: string; fullName: string; email: string; qrToken: string }) => {
    if (!order || !event) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 36;
    const eventDate = format(new Date(event.date), 'PPPP p');
    const template = (event.customization?.ticketPdfTemplateId || 'classic') as TicketPdfTemplate;
    const primaryRgb = hexToRgb(event.customization?.ticketPdfPrimaryColor || '#0d585b', [13, 88, 91]);
    const accentRgb = hexToRgb(event.customization?.ticketPdfAccentColor || '#b8f25a', [184, 242, 90]);
    const badgeText = event.customization?.ticketPdfBadgeText || 'EVENT PASS';
    const footerNote = event.customization?.ticketPdfFooterNote || 'Please bring this ticket and a valid ID.';
    const darkText: [number, number, number] = template === 'midnight' ? [229, 231, 235] : [17, 24, 39];
    const bodyBg: [number, number, number] = template === 'midnight' ? [17, 24, 39] : [255, 255, 255];
    const bodyBorder: [number, number, number] = template === 'midnight' ? [55, 65, 81] : [229, 231, 235];
    const panelBg: [number, number, number] = template === 'midnight' ? [31, 41, 55] : [249, 250, 251];

    if (template === 'sunset') {
      doc.setFillColor(255, 247, 237);
      doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
    } else {
      doc.setFillColor(bodyBg[0], bodyBg[1], bodyBg[2]);
      doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');
    }

    doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    doc.roundedRect(margin, margin, pageWidth - margin * 2, 88, 14, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(badgeText, margin + 18, margin + 28);
    doc.setFontSize(20);
    doc.text(event.title.slice(0, 48), margin + 18, margin + 56, { maxWidth: pageWidth - margin * 2 - 36 });

    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order #${order.id}`, margin + 18, margin + 118);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(attendee.fullName, margin + 18, margin + 142);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(attendee.email, margin + 18, margin + 160);
    doc.text(eventDate, margin + 18, margin + 182);
    doc.text(event.location, margin + 18, margin + 200, { maxWidth: 280 });

    doc.setDrawColor(bodyBorder[0], bodyBorder[1], bodyBorder[2]);
    doc.setFillColor(panelBg[0], panelBg[1], panelBg[2]);
    doc.roundedRect(margin, margin + 220, pageWidth - margin * 2 - 200, 120, 12, 12, 'FD');
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('ENTRY CODE', margin + 18, margin + 245);
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text(attendee.qrToken, margin + 18, margin + 265, { maxWidth: 280 });

    const qrCanvas = document.getElementById(`ticket-qr-${attendee.id}`) as HTMLCanvasElement | null;
    if (qrCanvas) {
      const qrData = qrCanvas.toDataURL('image/png');
      doc.setFillColor(panelBg[0], panelBg[1], panelBg[2]);
      doc.setDrawColor(bodyBorder[0], bodyBorder[1], bodyBorder[2]);
      doc.roundedRect(pageWidth - margin - 190, margin + 220, 170, 200, 12, 12, 'FD');
      doc.addImage(qrData, 'PNG', pageWidth - margin - 170, margin + 240, 130, 130);
      doc.setTextColor(darkText[0], darkText[1], darkText[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Scan at check-in', pageWidth - margin - 105, margin + 390, { align: 'center' });
    }

    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(footerNote, margin, margin + 460, { maxWidth: pageWidth - margin * 2 });
    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(margin, doc.internal.pageSize.getHeight() - 28, pageWidth - margin * 2, 4, 'F');

    const safeName = attendee.fullName.replace(/[^a-zA-Z0-9-_]+/g, '_');
    doc.save(`ticket_${order.id}_${safeName || 'attendee'}.pdf`);
  };

  const downloadAll = () => {
    order?.attendees?.forEach((a) => downloadAttendeeTicket(a));
  };

  const eventWhen = useMemo(() => {
    if (!event) return '';
    try {
      return format(new Date(event.date), 'EEE, d MMM yyyy · h:mm a');
    } catch {
      return event.date;
    }
  }, [event]);

  if (loading) {
    return (
      <div className="confirm-page confirm-loading">
        <div>
          <div className="confirm-spinner" style={{ margin: '0 auto' }} />
          <p className="confirm-sub" style={{ marginTop: '1rem' }}>
            Loading your tickets…
          </p>
        </div>
      </div>
    );
  }

  if (!order || !event) {
    return (
      <div className="confirm-page confirm-empty">
        <div style={{ maxWidth: 360 }}>
          <h1 className="confirm-title">Link unavailable</h1>
          <p className="confirm-sub">{loadError || 'We could not find your order details.'}</p>
          {!accessToken ? (
            <p className="confirm-hint">Open the full link from your SMS or confirmation email.</p>
          ) : null}
          <div style={{ marginTop: '1.25rem', display: 'grid', gap: '0.5rem' }}>
            <button type="button" className="confirm-btn confirm-btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <Link to="/" className="confirm-btn confirm-btn-secondary">
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (order.status === 'pending' && order.paymentMethod === 'bank_transfer') {
    const bank = order.bankTransfer || event.bankTransfer;
    const slipUrl = order.bankTransferSlipUrl
      ? order.bankTransferSlipUrl.startsWith('http')
        ? order.bankTransferSlipUrl
        : toApiUrl(order.bankTransferSlipUrl)
      : null;

    return (
      <div className="confirm-page">
        <div className="confirm-shell">
          <div className="confirm-hero">
            <span className="confirm-badge">
              <Landmark className="h-3 w-3" /> Awaiting transfer
            </span>
            <h1 className="confirm-title" style={{ marginTop: '0.85rem' }}>
              Complete your payment
            </h1>
            <p className="confirm-sub">
              Order #{order.id} · {formatLKRWhole(order.totalAmount)}. Transfer the exact amount, then upload your slip.
            </p>
          </div>

          <div className="confirm-card">
            <div className="confirm-card-body">
              {bank ? (
                <>
                  <p className="confirm-section-label">Bank details</p>
                  <div className="confirm-meta">
                    {[
                      ['Account name', bank.accountHolderName],
                      ['Account number', bank.accountNumber],
                      ['Bank', bank.bankName],
                      ['Branch', bank.bankBranch],
                    ].map(([label, value]) => (
                      <div key={label} className="confirm-line-item">
                        <span style={{ color: 'var(--confirm-muted)' }}>{label}</span>
                        <strong style={{ textAlign: 'right' }}>{value}</strong>
                      </div>
                    ))}
                    {bank.accountNote ? (
                      <div className="confirm-line-item confirm-line-item--note">
                        <span style={{ color: 'var(--confirm-muted)' }}>Account note</span>
                        <strong>{bank.accountNote}</strong>
                      </div>
                    ) : null}
                    <div className="confirm-line-item">
                      <span style={{ color: 'var(--confirm-muted)' }}>Amount</span>
                      <strong>{formatLKRWhole(order.totalAmount)}</strong>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="confirm-section">
                <p className="confirm-section-label">Transfer slip</p>
                {slipUrl ? (
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    <p className="confirm-sub" style={{ margin: 0, textAlign: 'left' }}>
                      Slip uploaded · awaiting organizer confirmation
                    </p>
                    <a href={slipUrl} target="_blank" rel="noreferrer" className="confirm-btn confirm-btn-secondary">
                      View uploaded slip
                    </a>
                    <button type="button" className="confirm-btn confirm-btn-primary" disabled={uploadingSlip} onClick={() => slipInputRef.current?.click()}>
                      Replace slip
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="confirm-btn confirm-btn-primary"
                    disabled={uploadingSlip}
                    onClick={() => slipInputRef.current?.click()}
                  >
                    <UploadCloud className="h-4 w-4" />
                    {uploadingSlip ? 'Uploading…' : 'Upload transfer slip'}
                  </button>
                )}
                <input
                  ref={slipInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadSlip(file);
                  }}
                />
                {slipError ? <p className="confirm-hint" style={{ color: '#b91c1c' }}>{slipError}</p> : null}
                {slipFeedback ? <p className="confirm-hint" style={{ color: 'var(--confirm-accent)' }}>{slipFeedback}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (order.status === 'pending') {
    return (
      <div className="confirm-page confirm-loading">
        <div>
          <div className="confirm-spinner" style={{ margin: '0 auto' }} />
          <h1 className="confirm-title" style={{ marginTop: '1rem' }}>
            Confirming payment…
          </h1>
          <p className="confirm-sub">This usually takes a few seconds. Keep this page open.</p>
          <button type="button" className="confirm-btn confirm-btn-primary" style={{ marginTop: '1.25rem' }} onClick={() => window.location.reload()}>
            Refresh status
          </button>
        </div>
      </div>
    );
  }

  if (order.status === 'failed') {
    return (
      <div className="confirm-page confirm-empty">
        <div style={{ maxWidth: 360 }}>
          <h1 className="confirm-title">Payment not completed</h1>
          <p className="confirm-sub">This order was cancelled or rejected. Contact the organizer if you already paid.</p>
          <Link to="/" className="confirm-btn confirm-btn-primary" style={{ marginTop: '1.25rem' }}>
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const isHolderView = order.viewScope === 'attendee';
  const passCount = order.attendees?.length ?? 0;
  const organizerName = event.organizerName?.trim() || '';
  const bannerUrl = event.bannerUrl
    ? event.bannerUrl.startsWith('http') || event.bannerUrl.startsWith('/api/')
      ? event.bannerUrl
      : toApiUrl(event.bannerUrl)
    : '';

  return (
    <div className="confirm-page">
      <div className="confirm-shell">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="confirm-hero">
            <span className="confirm-badge">Booking confirmed</span>
            <div className="confirm-check" aria-hidden>
              <Check className="h-8 w-8" strokeWidth={2.75} />
            </div>
            <h1 className="confirm-title">{isHolderView ? (passCount > 1 ? 'Your tickets are ready' : 'Your ticket is ready') : "You're all set"}</h1>
            <p className="confirm-sub">
              {isHolderView
                ? 'Show your QR code at the entrance for check-in.'
                : 'Your e-tickets are below. Save them or download a PDF for offline entry.'}
            </p>
          </div>

          <div className="confirm-card">
            {bannerUrl ? <img className="confirm-banner" src={bannerUrl} alt="" /> : null}
            <div className="confirm-card-body">
              <h2 className="confirm-event-name">{event.title}</h2>
              {organizerName ? <p className="confirm-organizer">Presented by {organizerName}</p> : null}

              <div className="confirm-meta">
                <div className="confirm-meta-row">
                  <span className="confirm-meta-icon">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <div>
                    <strong>{eventWhen || 'Date to be announced'}</strong>
                    When
                  </div>
                </div>
                <div className="confirm-meta-row">
                  <span className="confirm-meta-icon">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <strong>{event.location}</strong>
                    Venue
                  </div>
                </div>
              </div>

              <div className="confirm-stats">
                <div className="confirm-stat">
                  <span>Booking ID</span>
                  <strong>#{order.id}</strong>
                </div>
                <div className="confirm-stat">
                  <span>Total</span>
                  <strong>{order.totalAmount <= 0 ? 'Free' : formatLKRWhole(order.totalAmount)}</strong>
                </div>
              </div>

              {!isHolderView && order.tickets.length > 0 ? (
                <div className="confirm-section">
                  <p className="confirm-section-label">Order summary</p>
                  {order.tickets.map((t, i) => (
                    <div key={`${t.name}-${i}`} className="confirm-line-item">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Ticket className="h-3.5 w-3.5" style={{ color: 'var(--confirm-accent)' }} />
                        {t.name} ×{t.quantity}
                      </span>
                      <strong>{t.price <= 0 ? 'Free' : formatLKRWhole(t.price * t.quantity)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {order.attendees && order.attendees.length > 0 ? (
            <div className="confirm-section">
              <p className="confirm-section-label">{isHolderView ? 'Your pass' : `Your passes (${passCount})`}</p>
              {order.attendees.map((a) => (
                <div key={a.id} className="confirm-pass">
                  {a.ticketName ? <div className="confirm-pass-tier">{a.ticketName}</div> : null}
                  <h3 className="confirm-pass-name">{a.fullName}</h3>
                  <p className="confirm-pass-email">{a.email}</p>
                  <div className="confirm-qr-wrap">
                    <QRCodeCanvas
                      id={`ticket-qr-${a.id}`}
                      value={a.qrToken}
                      size={168}
                      bgColor="#ffffff"
                      fgColor="#0c1f24"
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <span className={`confirm-status ${a.checkedInAt ? 'is-done' : 'is-ready'}`}>
                    {a.checkedInAt ? 'Checked in' : 'Ready for check-in'}
                  </span>
                  <div className="confirm-pass-actions">
                    <button type="button" className="confirm-btn confirm-btn-primary" onClick={() => downloadAttendeeTicket(a)}>
                      <Download className="h-4 w-4" />
                      Download PDF ticket
                    </button>
                  </div>
                </div>
              ))}
              <p className="confirm-hint">Keep this page bookmarked. Staff will scan your QR at the door.</p>
            </div>
          ) : null}

          <div className="confirm-desktop-actions">
            {passCount > 0 ? (
              <button type="button" className="confirm-btn confirm-btn-primary" onClick={downloadAll}>
                <Download className="h-4 w-4" />
                {passCount > 1 ? 'Download all tickets' : 'Download ticket PDF'}
              </button>
            ) : null}
            <Link to={`/e/${event.slug}`} className="confirm-btn confirm-btn-secondary">
              View event page
            </Link>
          </div>
        </motion.div>
      </div>

      {passCount > 0 ? (
        <div className="confirm-dock">
          <div className="confirm-dock-inner">
            <button type="button" className="confirm-btn confirm-btn-primary" onClick={downloadAll}>
              <Download className="h-4 w-4" />
              {passCount > 1 ? 'Download all tickets' : 'Download ticket PDF'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
