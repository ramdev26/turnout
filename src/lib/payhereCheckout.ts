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
  orderId: string;
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
    order_id: pick('order_id') || str(res.orderId),
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

/**
 * Full-page Checkout API POST (legacy fallback — not used for normal checkout).
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

  document.body.appendChild(form);
  form.submit();
}

export function redirectToPayHereCheckout(res: PayHereInitiateResponse): void {
  const fields = buildPayHerePaymentFromInitiate(res);
  if (!fields.hash) {
    throw new Error('PayHere hash missing from server.');
  }
  submitPayHereCheckoutForm(resolvePayHereActionUrl(res), fields as unknown as Record<string, unknown>);
}

export type PayHereCheckoutHandlers = {
  onCompleted?: (orderId: string) => void | Promise<void>;
  onDismissed?: () => void;
  onError?: (message: string) => void;
  /** If true, falls back to full-page redirect when the SDK cannot load. Default false. */
  allowPageRedirectFallback?: boolean;
};

/**
 * PayHere JavaScript SDK popup — stays on your event page (no redirect to PayHere).
 * @see https://support.payhere.lk/api-&-mobile-sdk/javascript-sdk
 */
export async function startPayHereCheckout(
  res: PayHereInitiateResponse,
  handlers: PayHereCheckoutHandlers = {}
): Promise<void> {
  const payment = buildPayHerePaymentFromInitiate(res);

  try {
    await loadPayHereScript(payment.sandbox);
  } catch (err) {
    if (handlers.allowPageRedirectFallback) {
      redirectToPayHereCheckout(res);
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
    if (handlers.allowPageRedirectFallback) {
      redirectToPayHereCheckout(res);
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
    handlers.onError?.(
      error ||
        'Could not open the payment window. Allow pop-ups for this site in your browser, then try again.'
    );
  };

  payhere.startPayment(payment as unknown as Record<string, unknown>);
}
