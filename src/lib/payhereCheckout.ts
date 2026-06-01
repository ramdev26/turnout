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
    address: pick('address'),
    city: pick('city'),
    country: pick('country') || 'Sri Lanka',
    custom_1: pick('custom_1') || 'turnout',
    custom_2: pick('custom_2'),
  };
}
