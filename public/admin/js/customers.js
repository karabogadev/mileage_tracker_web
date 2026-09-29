import * as api from './api.js';
import { DAY_MS, appendRows, badge, clear, emptyState, errorBox, formatDate, formatDateTime, formatValue, h, load, table } from './dom.js';

const DURATIONS = [
  { label: '1 week', ms: 7 * DAY_MS },
  { label: '1 month', ms: 30 * DAY_MS },
  { label: '1 year', ms: 365 * DAY_MS },
  { label: 'Lifetime (100 years)', ms: 36500 * DAY_MS },
];

// total_revenue_in_usd / revenue_in_usd are { gross, proceeds, … } objects
const revenue = (money) => formatValue(money && typeof money === 'object' ? money.gross : money, '$');

// ---------- List ------------------------------------------------------------------------------------------

export function renderCustomers(root) {
  const results = h('div');
  const input = h('input', { type: 'search', name: 'q', placeholder: 'Email, app user ID or store transaction ID', autocomplete: 'off', 'aria-label': 'Search customers' });
  const form = h('form', { class: 'search', onsubmit: (e) => { e.preventDefault(); search(input.value.trim()); } }, input, h('button', { class: 'btn', type: 'submit' }, 'Search'));
  root.append(form, results);

  // A newer search invalidates every response still in flight, including "Load more" for the previous one.
  let latest = 0;

  async function search(term) {
    const mine = ++latest;
    clear(results).append(emptyState('Loading…'));
    try {
      const page = await api.listCustomers({ search: term || undefined });
      if (mine === latest) show(page, mine);
    } catch (err) {
      if (mine === latest) clear(results).append(errorBox(err));
    }
  }

  function show({ items, next }, mine) {
    const list = table(['Customer', 'Country', 'Platform', 'App', 'First seen', 'Last seen'], items.map(row), 'No customers found');
    clear(results).append(list);
    if (items.length) more({ next }, list, mine);
  }

  function more({ next }, list, mine) {
    if (!next) return;
    const button = h('button', { class: 'btn btn-quiet more', type: 'button', onclick: async () => {
      button.disabled = true;
      try {
        const page = await api.listCustomers({ cursor: next });
        if (mine !== latest) return;
        appendRows(list, page.items.map(row));
        button.remove();
        more(page, list, mine);
      } catch (err) {
        button.disabled = false;
        if (mine === latest) results.append(errorBox(err));
      }
    } }, 'Load more');
    results.append(button);
  }

  const row = (c) => [
    h('button', { class: 'link', type: 'button', onclick: () => openCustomer(root, c.id) }, h('code', {}, c.id)),
    c.last_seen_country ?? '–', c.last_seen_platform ?? '–', c.last_seen_app_version ?? '–',
    formatDate(c.first_seen_at), formatDate(c.last_seen_at),
  ];

  search('');
}

// ---------- Detail ----------------------------------------------------------------------------------------

function openCustomer(root, id) {
  const view = h('div', { class: 'detail' });
  const backToList = () => { clear(root); renderCustomers(root); };
  clear(root).append(h('button', { class: 'link back', type: 'button', onclick: backToList }, '← All customers'), view);
  loadDetail(view, id, backToList);
}

const loadDetail = (view, id, backToList) => load(view, async () => {
  const [customer, subscriptions, purchases, products, entitlements] = await Promise.all([
    api.getCustomer(id), api.listSubscriptions(id), api.listPurchases(id), api.listProducts(), api.listEntitlements(),
  ]);
  const productName = (pid) => products.find((p) => p.id === pid)?.display_name ?? pid ?? '–';
  const entitlementName = (eid) => entitlements.find((e) => e.id === eid)?.display_name ?? eid;
  const active = customer.active_entitlements?.items ?? [];
  const hasPromo = subscriptions.some((s) => s.store === 'promotional' && s.gives_access !== false);
  const reload = () => loadDetail(view, id, backToList);
  const status = h('div', { role: 'status' }); // errors from grant/revoke land here, one at a time

  return [
    h('header', { class: 'detail-head' }, h('h2', {}, h('code', {}, customer.id)),
      h('p', { class: 'muted' }, `${customer.last_seen_platform ?? '–'} ${customer.last_seen_app_version ?? ''} · ${customer.last_seen_country ?? '–'} · first seen ${formatDate(customer.first_seen_at)} · last seen ${formatDateTime(customer.last_seen_at)}`)),

    h('section', {}, h('h3', {}, 'Premium'),
      active.length
        ? h('ul', { class: 'ent-list' }, active.map((a) => h('li', {}, badge('active', 'ok'), ` ${entitlementName(a.entitlement_id)} · expires ${a.expires_at ? formatDateTime(a.expires_at) : 'never'} `,
          hasPromo && h('button', { class: 'btn btn-danger btn-small', type: 'button', onclick: (e) => revoke(e.currentTarget, customer, a, entitlementName(a.entitlement_id), status, reload) }, 'Revoke promotional access'))))
        : emptyState('No active entitlements'),
      grantForm(customer, entitlements.filter((e) => e.state === 'active'), status, reload), status),

    h('section', {}, h('h3', {}, 'Subscriptions'), table(['Product', 'Status', 'Store', 'Started', 'Period ends', 'Revenue'], subscriptions.map((s) => [
      productName(s.product_id), badge(s.status ?? '–', s.gives_access ? 'ok' : 'neutral'), s.store === 'promotional' ? badge('promotional', 'warn') : s.store ?? '–',
      formatDate(s.starts_at), formatDate(s.current_period_ends_at), revenue(s.total_revenue_in_usd)]))),

    h('section', {}, h('h3', {}, 'Purchases'), table(['Product', 'Date', 'Store', 'Status', 'Revenue'], purchases.map((p) => [
      productName(p.product_id), formatDate(p.purchased_at), p.store ?? '–', p.status ?? '–', revenue(p.revenue_in_usd)]))),

    h('section', { class: 'danger-zone' }, h('h3', {}, 'Danger zone'),
      h('p', { class: 'muted' }, 'Permanently deletes this customer and their data from RevenueCat. This cannot be undone and does not cancel any store subscription.'),
      h('button', { class: 'btn btn-danger', type: 'button', onclick: (e) => remove(e.currentTarget, customer, status, backToList) }, 'Delete customer…')),
  ];
});

// ---------- Grant / revoke --------------------------------------------------------------------------------

/** Runs `action` with `button` disabled so a double click cannot fire it twice; failures replace the message in `status`. */
async function guarded(button, status, action) {
  button.disabled = true;
  clear(status);
  try {
    await action();
  } catch (err) {
    status.append(errorBox(err));
  } finally {
    button.disabled = false;
  }
}

function grantForm(customer, entitlements, status, reload) {
  const entitlement = h('select', { 'aria-label': 'Entitlement' }, entitlements.map((e) => h('option', { value: e.id }, e.display_name)));
  const duration = h('select', { 'aria-label': 'Duration' }, DURATIONS.map((d) => h('option', { value: d.ms }, d.label)));
  const button = h('button', { class: 'btn', type: 'submit', disabled: !entitlements.length }, 'Grant…');

  const submit = (e) => {
    e.preventDefault();
    return guarded(button, status, async () => {
      const expiresAt = Date.now() + Number(duration.value);
      const ok = await confirmDialog({
        title: 'Grant premium?',
        body: `${entitlement.selectedOptions[0].textContent} will be granted to ${customer.id} until ${formatDateTime(expiresAt)}, without a store purchase.`,
        confirmLabel: 'Grant',
      });
      if (!ok) return;
      await api.grantEntitlement(customer.id, entitlement.value, expiresAt);
      reload();
    });
  };

  return h('form', { class: 'grant', onsubmit: submit }, h('h4', {}, 'Grant promotional access'), h('div', { class: 'grant-row' }, entitlement, duration, button));
}

const revoke = (button, customer, active, name, status, reload) => guarded(button, status, async () => {
  const ok = await confirmDialog({
    title: 'Revoke premium?',
    body: `All promotional access to ${name} will be revoked for ${customer.id}. Store purchases are not affected.`,
    confirmLabel: 'Revoke',
    danger: true,
  });
  if (!ok) return;
  await api.revokeEntitlement(customer.id, active.entitlement_id);
  reload();
});

const remove = (button, customer, status, backToList) => guarded(button, status, async () => {
  const ok = await confirmDialog({
    title: 'Delete customer?',
    body: `${customer.id} and all their data will be permanently deleted from RevenueCat. This cannot be undone.`,
    confirmLabel: 'Delete',
    danger: true,
    requireText: 'delete',
  });
  if (!ok) return;
  await api.deleteCustomer(customer.id);
  backToList();
});

/** Resolves true on confirm. With `requireText` the confirm button stays disabled until that word is typed. */
function confirmDialog({ title, body, confirmLabel, danger = false, requireText }) {
  return new Promise((resolve) => {
    const confirm = h('button', { class: `btn${danger ? ' btn-danger' : ''}`, value: 'confirm', disabled: !!requireText }, confirmLabel);
    const field = requireText && h('input', {
      type: 'text', autocomplete: 'off', placeholder: requireText, 'aria-label': `Type "${requireText}" to confirm`,
      oninput: () => { confirm.disabled = field.value.trim().toLowerCase() !== requireText; },
    });
    const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-title' },
      h('form', { method: 'dialog' },
        h('h3', { id: 'dlg-title' }, title), h('p', {}, body),
        field && h('p', { class: 'dialog-confirm' }, h('label', {}, `Type "${requireText}" to confirm`), field),
        h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-quiet', value: 'cancel' }, 'Cancel'), confirm)));
    dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'confirm'); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
  });
}
