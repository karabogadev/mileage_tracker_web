// RevenueCat REST API v2 client. The secret key lives only in this module's closure – never in storage, the DOM
// or a URL – and is dropped by lock(). Requests only ever go to api.revenuecat.com.

const ORIGIN = 'https://api.revenuecat.com';
const PROJECT_ID = 'projb556e19e'; // Fahrtenbuch

let apiKey = null;

class ApiError extends Error {
  constructor(status, message, requestId) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}

export const unlock = (key) => { apiKey = key; };
export const lock = () => { apiKey = null; };

// Called after a 401 (revoked or wrong key) so the UI can fall back to the unlock screen.
let onRejected = () => {};
export const onKeyRejected = (fn) => { onRejected = fn; };

const project = (rest = '') => `/projects/${PROJECT_ID}${rest}`;
const customer = (id, rest = '') => project(`/customers/${encodeURIComponent(id)}${rest}`);

async function request(path, { method = 'GET', params, body, retries = 2 } = {}) {
  if (apiKey === null) throw new ApiError(401, 'Panel is locked');

  // `path` is a route ('/projects/…') or a next_page cursor, which RevenueCat may send as an absolute URL or as '/v2/…'.
  const url = new URL(/^(https?:|\/v2\/)/.test(path) ? path : `/v2${path}`, ORIGIN);
  if (url.origin !== ORIGIN) throw new Error(`Refusing to send the API key to ${url.origin}`);
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== '') url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });

  if (res.status === 429 && retries > 0) {
    const wait = Number(res.headers.get('retry-after')) || 2;
    await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
    return request(path, { method, params, body, retries: retries - 1 });
  }

  const requestId = res.headers.get('x-request-id');
  const data = await res.json().catch(() => null);
  if (res.status === 401) { lock(); onRejected(); }
  if (!res.ok) {
    const hint = res.status === 403 ? ' – the key lacks a permission for this call (deleting and granting need Customer information: Read & Write)' : '';
    throw new ApiError(res.status, `${data?.message ?? res.statusText}${hint}`, requestId);
  }
  return data;
}

/** One page of a list endpoint: { items, next } where `next` is passed back in as `cursor` for the following page. */
async function page(path, { limit = 20, cursor, ...params } = {}) {
  const data = await request(cursor ?? path, { params: cursor ? undefined : { limit, ...params } });
  return { items: data.items ?? [], next: data.next_page ?? null };
}

async function all(path, params) {
  const items = [];
  let cursor;
  do {
    const res = await page(path, { limit: 100, cursor, ...params });
    items.push(...res.items);
    cursor = res.next;
  } while (cursor);
  return items;
}

// --- Reads -------------------------------------------------------------------------------------------------

export const getOverview = () => request(project('/metrics/overview'));

export const getChart = (name, { start, end, resolution }) =>
  request(project(`/charts/${name}`), { params: { start_date: start, end_date: end, resolution, realtime: true } });

export const listCustomers = (opts) => page(project('/customers'), opts);
export const getCustomer = (id) => request(customer(id));
export const listSubscriptions = (id) => all(customer(id, '/subscriptions'));
export const listPurchases = (id) => all(customer(id, '/purchases'));

export const listApps = () => all(project('/apps'));
export const listProducts = () => all(project('/products'));
export const listEntitlements = () => all(project('/entitlements'));
export const listOfferings = () => all(project('/offerings'));
export const listWebhooks = () => all(project('/integrations/webhooks'));

// --- Writes ------------------------------------------------------------------------------------------------

export const grantEntitlement = (id, entitlementId, expiresAt) =>
  request(customer(id, '/actions/grant_entitlement'), { method: 'POST', body: { entitlement_id: entitlementId, expires_at: expiresAt } });

export const deleteCustomer = (id) => request(customer(id), { method: 'DELETE' });

export const revokeEntitlement = (id, entitlementId) =>
  request(customer(id, '/actions/revoke_granted_entitlement'), { method: 'POST', body: { entitlement_id: entitlementId } });
