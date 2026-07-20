export type CheckoutCart = {
  eventId: string;
  selectedTickets: Record<string, number>;
  savedAt: number;
};

const STORAGE_PREFIX = 'turnout:checkout-cart:';

function storageKey(eventId: string): string {
  return `${STORAGE_PREFIX}${eventId}`;
}

export function saveCheckoutCart(cart: CheckoutCart): void {
  try {
    sessionStorage.setItem(storageKey(cart.eventId), JSON.stringify(cart));
  } catch {
    // Ignore quota / private mode failures — navigation state is the primary path.
  }
}

export function loadCheckoutCart(eventId: string): CheckoutCart | null {
  try {
    const raw = sessionStorage.getItem(storageKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutCart;
    if (
      !parsed ||
      parsed.eventId !== eventId ||
      !parsed.selectedTickets ||
      typeof parsed.selectedTickets !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutCart(eventId: string): void {
  try {
    sessionStorage.removeItem(storageKey(eventId));
  } catch {
    // ignore
  }
}
