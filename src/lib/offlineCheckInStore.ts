/** IndexedDB store for offline door check-in roster + pending scan queue. */

export type OfflineRosterAttendee = {
  id: string;
  eventId: string;
  qrToken: string;
  fullName: string;
  email: string;
  ticketName: string;
  checkedInAt: string | null;
};

export type PendingOfflineScan = {
  clientScanId: string;
  eventId: string;
  qrToken: string;
  scannedAt: string;
  fullName: string;
  email: string;
  ticketName: string;
};

export type OfflineRosterMeta = {
  eventId: string;
  total: number;
  downloadedAt: string;
  lastDeltaAt: string | null;
};

const DB_NAME = 'turnout_offline_checkin';
const DB_VERSION = 1;
const STORE_ROSTER = 'roster';
const STORE_QUEUE = 'queue';
const STORE_META = 'meta';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ROSTER)) {
        const roster = db.createObjectStore(STORE_ROSTER, { keyPath: ['eventId', 'qrToken'] });
        roster.createIndex('byEvent', 'eventId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const queue = db.createObjectStore(STORE_QUEUE, { keyPath: 'clientScanId' });
        queue.createIndex('byEvent', 'eventId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'eventId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open offline check-in database'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

export async function getOfflineRosterMeta(eventId: string): Promise<OfflineRosterMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const req = tx.objectStore(STORE_META).get(eventId);
    req.onsuccess = () => resolve((req.result as OfflineRosterMeta | undefined) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setOfflineRosterMeta(meta: OfflineRosterMeta): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_META, 'readwrite');
  tx.objectStore(STORE_META).put(meta);
  await txDone(tx);
}

export async function clearOfflineRoster(eventId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_ROSTER, STORE_META], 'readwrite');
  const roster = tx.objectStore(STORE_ROSTER);
  const index = roster.index('byEvent');
  const req = index.openCursor(IDBKeyRange.only(eventId));
  req.onsuccess = () => {
    const cursor = req.result;
    if (!cursor) return;
    cursor.delete();
    cursor.continue();
  };
  tx.objectStore(STORE_META).delete(eventId);
  await txDone(tx);
}

export async function upsertOfflineRoster(
  eventId: string,
  attendees: OfflineRosterAttendee[],
  opts?: { replace?: boolean; total?: number; downloadedAt?: string }
): Promise<OfflineRosterMeta> {
  const db = await openDb();
  const tx = db.transaction([STORE_ROSTER, STORE_META], 'readwrite');
  const roster = tx.objectStore(STORE_ROSTER);

  if (opts?.replace) {
    const index = roster.index('byEvent');
    await new Promise<void>((resolve, reject) => {
      const req = index.openCursor(IDBKeyRange.only(eventId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  for (const a of attendees) {
    const token = a.qrToken.toLowerCase();
    roster.put({
      ...a,
      eventId,
      qrToken: token,
    });
  }

  const existingMeta = await new Promise<OfflineRosterMeta | null>((resolve, reject) => {
    const req = tx.objectStore(STORE_META).get(eventId);
    req.onsuccess = () => resolve((req.result as OfflineRosterMeta | undefined) || null);
    req.onerror = () => reject(req.error);
  });

  const meta: OfflineRosterMeta = {
    eventId,
    total: opts?.total ?? existingMeta?.total ?? attendees.length,
    downloadedAt: opts?.downloadedAt ?? existingMeta?.downloadedAt ?? new Date().toISOString(),
    lastDeltaAt: existingMeta?.lastDeltaAt ?? null,
  };
  if (opts?.replace || opts?.downloadedAt) {
    meta.lastDeltaAt = meta.downloadedAt;
  }
  tx.objectStore(STORE_META).put(meta);
  await txDone(tx);
  return meta;
}

export async function applyOfflineRosterUpdates(
  eventId: string,
  updates: OfflineRosterAttendee[],
  serverTime: string
): Promise<void> {
  if (updates.length === 0) {
    const meta = await getOfflineRosterMeta(eventId);
    if (meta) {
      await setOfflineRosterMeta({ ...meta, lastDeltaAt: serverTime });
    }
    return;
  }

  const db = await openDb();
  const tx = db.transaction([STORE_ROSTER, STORE_META], 'readwrite');
  const roster = tx.objectStore(STORE_ROSTER);
  for (const a of updates) {
    const token = a.qrToken.toLowerCase();
    const key = [eventId, token];
    const existing = await new Promise<OfflineRosterAttendee | undefined>((resolve, reject) => {
      const req = roster.get(key);
      req.onsuccess = () => resolve(req.result as OfflineRosterAttendee | undefined);
      req.onerror = () => reject(req.error);
    });
    roster.put({
      ...(existing || a),
      ...a,
      eventId,
      qrToken: token,
      checkedInAt: a.checkedInAt ?? existing?.checkedInAt ?? null,
    });
  }
  const meta = await new Promise<OfflineRosterMeta | null>((resolve, reject) => {
    const req = tx.objectStore(STORE_META).get(eventId);
    req.onsuccess = () => resolve((req.result as OfflineRosterMeta | undefined) || null);
    req.onerror = () => reject(req.error);
  });
  if (meta) {
    tx.objectStore(STORE_META).put({ ...meta, lastDeltaAt: serverTime });
  }
  await txDone(tx);
}

export async function lookupOfflineAttendee(
  eventId: string,
  qrToken: string
): Promise<OfflineRosterAttendee | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROSTER, 'readonly');
    const req = tx.objectStore(STORE_ROSTER).get([eventId, qrToken.toLowerCase()]);
    req.onsuccess = () => resolve((req.result as OfflineRosterAttendee | undefined) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function markOfflineCheckedIn(
  eventId: string,
  qrToken: string,
  checkedInAt: string
): Promise<OfflineRosterAttendee | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_ROSTER, 'readwrite');
  const store = tx.objectStore(STORE_ROSTER);
  const key = [eventId, qrToken.toLowerCase()];
  const existing = await new Promise<OfflineRosterAttendee | undefined>((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as OfflineRosterAttendee | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!existing) {
    await txDone(tx);
    return null;
  }
  const updated = { ...existing, checkedInAt };
  store.put(updated);
  await txDone(tx);
  return updated;
}

export async function enqueueOfflineScan(scan: PendingOfflineScan): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).put({
    ...scan,
    qrToken: scan.qrToken.toLowerCase(),
  });
  await txDone(tx);
}

export async function listPendingOfflineScans(eventId: string): Promise<PendingOfflineScan[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const index = tx.objectStore(STORE_QUEUE).index('byEvent');
    const req = index.getAll(IDBKeyRange.only(eventId));
    req.onsuccess = () => resolve((req.result as PendingOfflineScan[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function countPendingOfflineScans(eventId: string): Promise<number> {
  const pending = await listPendingOfflineScans(eventId);
  return pending.length;
}

export async function removePendingOfflineScans(clientScanIds: string[]): Promise<void> {
  if (clientScanIds.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  for (const id of clientScanIds) {
    store.delete(id);
  }
  await txDone(tx);
}

export async function countOfflineRoster(eventId: string): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ROSTER, 'readonly');
    const index = tx.objectStore(STORE_ROSTER).index('byEvent');
    const req = index.count(IDBKeyRange.only(eventId));
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

export function newClientScanId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const OFFLINE_MODE_KEY = (eventId: string) => `turnout_offline_checkin_mode_${eventId}`;

export function getOfflineModeEnabled(eventId: string): boolean {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY(eventId)) === '1';
  } catch {
    return false;
  }
}

export function setOfflineModeEnabled(eventId: string, enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(OFFLINE_MODE_KEY(eventId), '1');
    else localStorage.removeItem(OFFLINE_MODE_KEY(eventId));
  } catch {
    // ignore quota
  }
}
