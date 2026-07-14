import { formatApiError } from '../utils/apiError';

/** PayHere Checkout / JS SDK payment object (snake_case per PayHere docs). */
export type PayHereCheckoutPayment = {
  sandbox: boolean;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  hash: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_country?: string;
  custom_1?: string;
  custom_2?: string;
};

export type PayHereInitiateResponse = {
  orderId?: string;
  setupOrderId?: string;
  accessToken?: string;
  actionUrl?: string;
  sandbox?: boolean;
  hash?: string;
  fields?: Record<string, string | boolean | undefined>;
  sdkPayment?: Record<string, unknown>;
};

type PayHereSdk = {
  startPayment: (payment: Record<string, unknown>) => void;
  onCompleted?: (orderId: string) => void;
  onDismissed?: () => void;
  onError?: (error: string) => void;
};

declare global {
  interface Window {
    payhere?: PayHereSdk;
  }
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim();
}

/**
 * Build the object passed to payhere.startPayment(). PayHere posts every own
 * property to the Checkout API; hash must be present or checkout is rejected.
 */
export function buildPayHerePaymentFromInitiate(res: PayHereInitiateResponse): PayHereCheckoutPayment {
  const sdk = res.sdkPayment ?? {};
  const fields = res.fields ?? {};
  const pick = (key: string): string => str(sdk[key] ?? fields[key]);

  const hash = pick('hash') || str(res.hash);
  if (!hash) {
    throw new Error('PayHere hash missing from server. Redeploy the API or check merchant credentials.');
  }

  const amount = pick('amount');
  const merchantId = pick('merchant_id');
  if (!merchantId || !amount) {
    throw new Error('PayHere payment details incomplete from server.');
  }

  const sandbox =
    typeof sdk.sandbox === 'boolean'
      ? sdk.sandbox
      : typeof fields.sandbox === 'boolean'
        ? fields.sandbox
        : !!res.sandbox;

  const returnUrl = pick('return_url');
  const cancelUrl = pick('cancel_url');
  if (!returnUrl || !cancelUrl || !pick('notify_url')) {
    throw new Error('PayHere return, cancel, or notify URL missing from server.');
  }

  return {
    sandbox,
    merchant_id: merchantId,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: pick('notify_url'),
    order_id: pick('order_id') || str(res.setupOrderId) || str(res.orderId),
    items: pick('items'),
    amount,
    currency: pick('currency') || 'LKR',
    hash,
    first_name: pick('first_name'),
    last_name: pick('last_name') || ' ',
    email: pick('email'),
    phone: pick('phone'),
    address: pick('address') || 'N/A',
    city: pick('city') || 'N/A',
    country: pick('country') || 'Sri Lanka',
    delivery_address: pick('delivery_address') || pick('address') || 'N/A',
    delivery_city: pick('delivery_city') || pick('city') || 'N/A',
    delivery_country: pick('delivery_country') || pick('country') || 'Sri Lanka',
    custom_1: pick('custom_1') || 'turnout',
    custom_2: pick('custom_2'),
  };
}

const PAYHERE_CHECKOUT_LIVE = 'https://www.payhere.lk/pay/checkout';
const PAYHERE_CHECKOUT_SANDBOX = 'https://sandbox.payhere.lk/pay/checkout';
/** Official SDK host (sandbox uses `payment.sandbox`, not a separate script URL). */
const PAYHERE_JS_URL = 'https://www.payhere.lk/lib/payhere.js';

let payhereScriptPromise: Promise<void> | null = null;

function resolvePayHereJsUrl(_sandbox: boolean): string {
  return PAYHERE_JS_URL;
}

function waitForPayHereSdk(timeoutMs = 8000): Promise<PayHereSdk> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (window.payhere?.startPayment) {
        resolve(window.payhere);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error('PayHere SDK did not initialize'));
        return;
      }
      window.setTimeout(tick, 40);
    };
    tick();
  });
}

function loadPayHereScript(sandbox: boolean): Promise<void> {
  const src = resolvePayHereJsUrl(sandbox);
  if (window.payhere?.startPayment) {
    return Promise.resolve();
  }

  if (payhereScriptPromise) {
    return payhereScriptPromise;
  }

  payhereScriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      waitForPayHereSdk()
        .then(() => resolve())
        .catch(reject);
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[data-payhere-sdk="${src}"]`);
    if (existing) {
      if (window.payhere?.startPayment) {
        resolve();
        return;
      }
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', () => reject(new Error('PayHere SDK failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.async = true;
    script.dataset.payhereSdk = src;
    script.onload = finish;
    script.onerror = () => reject(new Error('PayHere SDK failed to load'));
    document.head.appendChild(script);
  });

  return payhereScriptPromise;
}

/** Call when the event page loads so the PayHere popup opens instantly at checkout. */
export function preloadPayHereScript(sandbox: boolean): Promise<void> {
  return loadPayHereScript(sandbox);
}

/** Action URL from initiate response (full-page fallback only). */
export function resolvePayHereActionUrl(res: PayHereInitiateResponse): string {
  if (res.actionUrl) return res.actionUrl;
  const sandbox =
    res.sandbox === true ||
    res.fields?.sandbox === true ||
    res.sdkPayment?.sandbox === true;
  return sandbox ? PAYHERE_CHECKOUT_SANDBOX : PAYHERE_CHECKOUT_LIVE;
}

const PAYHERE_POPUP_NAME = 'payhere_checkout';

function payherePopupFeatures(): string {
  const w = 520;
  const h = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  return `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

function appendPayHereFormFields(form: HTMLFormElement, fields: Record<string, unknown>): void {
  const skip = new Set(['sandbox']);
  for (const [key, value] of Object.entries(fields)) {
    if (skip.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (value === '') continue;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  }
}

/**
 * Full-page Checkout API POST (last-resort fallback).
 * @see https://support.payhere.lk/api-&-mobile-sdk/checkout-api
 */
export function submitPayHereCheckoutForm(
  actionUrl: string,
  fields: Record<string, unknown>
): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  form.style.display = 'none';
  appendPayHereFormFields(form, fields);
  document.body.appendChild(form);
  form.submit();
}

/** Open a blank popup during the user click (avoids browser popup blockers). */
export function preparePayHereCheckoutPopup(): Window | null {
  return window.open('about:blank', PAYHERE_POPUP_NAME, payherePopupFeatures());
}

/** POST checkout into a centered browser popup (keeps the event page open). */
export function openPayHereCheckoutPopup(
  res: PayHereInitiateResponse,
  existingWindow?: Window | null
): Window | null {
  const fields = buildPayHerePaymentFromInitiate(res);
  if (!fields.hash) {
    throw new Error('PayHere hash missing from server.');
  }
  const actionUrl = resolvePayHereActionUrl(res);
  const popup =
    existingWindow && !existingWindow.closed
      ? existingWindow
      : window.open('about:blank', PAYHERE_POPUP_NAME, payherePopupFeatures());
  if (!popup) return null;

  try {
    const doc = popup.document;
    const form = doc.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    appendPayHereFormFields(form, fields as unknown as Record<string, unknown>);
    doc.body.appendChild(form);
    form.submit();
  } catch {
    popup.close();
    return null;
  }

  return popup;
}

type PayHerePopupMessage =
  | { type: 'payhere:completed'; orderId: string }
  | { type: 'payhere:cancelled'; orderId?: string };

let popupWatchId = 0;

function watchPayHereCheckoutPopup(
  popup: Window,
  handlers: PayHereCheckoutHandlers
): () => void {
  const watchId = ++popupWatchId;
  let settled = false;

  const finish = (fn?: () => void) => {
    if (settled || watchId !== popupWatchId) return;
    settled = true;
    window.removeEventListener('message', onMessage);
    window.clearInterval(poll);
    fn?.();
  };

  const onMessage = (ev: MessageEvent) => {
    if (ev.origin !== window.location.origin) return;
    const data = ev.data as PayHerePopupMessage | null;
    if (!data || typeof data !== 'object' || !('type' in data)) return;
    if (data.type === 'payhere:completed') {
      finish(() => {
        void Promise.resolve(handlers.onCompleted?.(data.orderId)).catch((err: unknown) => {
          handlers.onError?.(formatApiError(err, 'Could not confirm payment.'));
        });
      });
      return;
    }
    if (data.type === 'payhere:cancelled') {
      finish(() => handlers.onDismissed?.());
    }
  };

  const poll = window.setInterval(() => {
    if (popup.closed) {
      finish(() => handlers.onDismissed?.());
    }
  }, 400);

  window.addEventListener('message', onMessage);

  return () => {
    settled = true;
    window.removeEventListener('message', onMessage);
    window.clearInterval(poll);
  };
}

export function startPayHereCheckoutPopup(
  res: PayHereInitiateResponse,
  handlers: PayHereCheckoutHandlers = {},
  existingWindow?: Window | null
): boolean {
  const popup = openPayHereCheckoutPopup(res, existingWindow);
  if (!popup) {
    handlers.onError?.(
      'Could not open the payment popup. Allow pop-ups for this site in your browser settings, then try again.'
    );
    return false;
  }
  watchPayHereCheckoutPopup(popup, handlers);
  return true;
}

/** Full-page PayHere checkout in the current tab (fallback when SDK overlay cannot load). */
export function redirectToPayHereCheckout(res: PayHereInitiateResponse): void {
  const fields = buildPayHerePaymentFromInitiate(res);
  if (!fields.hash) {
    throw new Error('PayHere hash missing from server.');
  }
  submitPayHereCheckoutForm(resolvePayHereActionUrl(res), fields as unknown as Record<string, unknown>);
}

/** Notify opener window after PayHere redirect (popup checkout flow). */
export function notifyPayHereOpener(message: PayHerePopupMessage): void {
  if (!window.opener || window.opener.closed) return;
  try {
    window.opener.postMessage(message, window.location.origin);
    window.close();
  } catch {
    // ignore cross-window errors
  }
}

export type PayHereCheckoutHandlers = {
  onCompleted?: (orderId: string) => void | Promise<void>;
  onDismissed?: () => void;
  onError?: (message: string) => void;
  /** Skip SDK overlay; open PayHere in a centered browser popup. */
  preferWindowPopup?: boolean;
  /** If true, continues checkout in this tab when the SDK cannot load. */
  allowSameTabFallback?: boolean;
  /** @deprecated Use allowSameTabFallback. Opens a separate browser popup when SDK fails. */
  allowPopupFallback?: boolean;
};

/**
 * PayHere checkout on the current page — SDK overlay in-tab, with optional same-tab redirect fallback.
 * @see https://support.payhere.lk/api-&-mobile-sdk/javascript-sdk
 */
export async function startPayHereCheckout(
  res: PayHereInitiateResponse,
  handlers: PayHereCheckoutHandlers = {},
  existingWindow?: Window | null
): Promise<void> {
  if (handlers.preferWindowPopup) {
    startPayHereCheckoutPopup(res, handlers, existingWindow);
    return;
  }

  const payment = buildPayHerePaymentFromInitiate(res);
  const useSameTabFallback = handlers.allowSameTabFallback === true;
  const usePopupFallback = handlers.allowPopupFallback === true;

  try {
    await loadPayHereScript(payment.sandbox);
  } catch (err) {
    if (useSameTabFallback) {
      redirectToPayHereCheckout(res);
      return;
    }
    if (usePopupFallback && startPayHereCheckoutPopup(res, handlers)) {
      return;
    }
    handlers.onError?.(
      err instanceof Error
        ? err.message
        : 'Payment could not load. Check your connection and try again.'
    );
    return;
  }

  const payhere = window.payhere;
  if (!payhere?.startPayment) {
    if (useSameTabFallback) {
      redirectToPayHereCheckout(res);
      return;
    }
    if (usePopupFallback && startPayHereCheckoutPopup(res, handlers)) {
      return;
    }
    handlers.onError?.('Secure payment is unavailable. Refresh the page and try again.');
    return;
  }

  payhere.onCompleted = (orderId: string) => {
    const resolvedOrderId = orderId || payment.order_id;
    if (handlers.onCompleted) {
      void Promise.resolve(handlers.onCompleted(resolvedOrderId)).catch((err: unknown) => {
        handlers.onError?.(formatApiError(err, 'Could not confirm payment.'));
      });
      return;
    }
    const url = new URL(payment.return_url);
    if (resolvedOrderId) url.searchParams.set('order_id', resolvedOrderId);
    window.location.assign(url.toString());
  };

  payhere.onDismissed = () => {
    if (handlers.onDismissed) {
      handlers.onDismissed();
      return;
    }
    window.location.assign(payment.cancel_url);
  };

  payhere.onError = (error: string) => {
    if (useSameTabFallback) {
      redirectToPayHereCheckout(res);
      return;
    }
    if (usePopupFallback && startPayHereCheckoutPopup(res, handlers)) {
      return;
    }
    handlers.onError?.(
      error ||
        'Could not open the payment window. Refresh the page and try again.'
    );
  };

  payhere.startPayment(payment as unknown as Record<string, unknown>);
}

/** PayHere card preapproval for organizer billing (tokenizes card for platform fee collection). */
export async function startPayHerePreapprove(
  res: PayHereInitiateResponse,
  handlers: PayHereCheckoutHandlers = {}
): Promise<void> {
  const payment = {
    ...buildPayHerePaymentFromInitiate(res),
    preapprove: true,
  };
  const useSameTabFallback = handlers.allowSameTabFallback === true;

  try {
    await loadPayHereScript(payment.sandbox);
  } catch (err) {
    handlers.onError?.(
      err instanceof Error ? err.message : 'Billing card setup could not load. Check your connection and try again.'
    );
    return;
  }

  const payhere = window.payhere;
  if (!payhere?.startPayment) {
    handlers.onError?.('Secure card setup is unavailable. Refresh the page and try again.');
    return;
  }

  payhere.onCompleted = (orderId: string) => {
    const resolvedOrderId = orderId || payment.order_id;
    if (handlers.onCompleted) {
      void Promise.resolve(handlers.onCompleted(resolvedOrderId)).catch((err: unknown) => {
        handlers.onError?.(formatApiError(err, 'Could not confirm billing card setup.'));
      });
      return;
    }
    if (payment.return_url) {
      const url = new URL(payment.return_url);
      if (resolvedOrderId) url.searchParams.set('setup_order_id', resolvedOrderId);
      window.location.assign(url.toString());
    }
  };

  payhere.onDismissed = () => {
    handlers.onDismissed?.();
  };

  payhere.onError = (error: string) => {
    if (useSameTabFallback && res.actionUrl) {
      submitPayHereCheckoutForm(res.actionUrl, payment as unknown as Record<string, unknown>);
      return;
    }
    handlers.onError?.(error || 'Could not open card setup. Refresh the page and try again.');
  };

  payhere.startPayment(payment as unknown as Record<string, unknown>);
}
