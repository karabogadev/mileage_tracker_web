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

// RevenueCat queues a deletion and processes it in the background, so a deleted customer can still be listed for a
// while. Remember them for this session so the list doesn't look like the delete failed.
const deleted = new Set();

// ---------- List ------------------------------------------------------------------------------------------

export function renderCustomers(root, notice) {
  const results = h('div');
  const input = h('input', { type: 'search', name: 'q', placeholder: 'Email, app user ID or store transaction ID', autocomplete: 'off', 'aria-label': 'Search customers' });
  const form = h('form', { class: 'search', onsubmit: (e) => { e.preventDefault(); search(input.value.trim()); } }, input, h('button', { class: 'btn', type: 'submit' }, 'Search'));
  root.append(...[notice, form, results].filter(Boolean));

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
    const list = table(['Customer', 'Country', 'Platform', 'App', 'First seen', 'Last seen'], visible(items).map(row), 'No customers found');
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
        appendRows(list, visible(page.items).map(row));
        button.remove();
        more(page, list, mine);
      } catch (err) {
        button.disabled = false;
        if (mine === latest) results.append(errorBox(err));
      }
    } }, 'Load more');
    results.append(button);
  }

  const visible = (items) => items.filter((c) => !deleted.has(c.id));

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
  const backToList = (notice) => { clear(root); renderCustomers(root, notice); };
  clear(root).append(h('button', { class: 'link back', type: 'button', onclick: () => backToList() }, '← All customers'), view);
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
  const deleteStatus = h('div', { role: 'status' }); // next to the delete button, so its errors are seen

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
      h('button', { class: 'btn btn-danger', type: 'button', onclick: (e) => remove(e.currentTarget, customer, deleteStatus, backToList) }, 'Delete customer…'),
      deleteStatus),
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
    status.scrollIntoView({ block: 'nearest' });
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
  deleted.add(customer.id);
  backToList(h('div', { class: 'notice-ok', role: 'status' },
    `Deletion of ${customer.id} is queued. RevenueCat processes it in the background, so it can take a few minutes to disappear everywhere.`));
});

/**
 * Resolves true on confirm. With `requireText` the confirm button stays disabled until that word is typed.
 * Plain buttons close the dialog directly: no form submission, so Enter can't hit Cancel and the admin CSP's
 * form-action 'none' can't get in the way.
 */
function confirmDialog({ title, body, confirmLabel, danger = false, requireText }) {
  return new Promise((resolve) => {
    const typed = () => !field || field.value.trim().toLowerCase() === requireText;
    const field = requireText && h('input', {
      type: 'text', autocomplete: 'off', autocapitalize: 'off', placeholder: requireText, 'aria-label': `Type "${requireText}" to confirm`,
      oninput: () => { confirm.disabled = !typed(); },
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); if (typed()) dialog.close('confirm'); } },
    });
    const confirm = h('button', { class: `btn${danger ? ' btn-danger' : ''}`, type: 'button', disabled: !typed(), onclick: () => dialog.close('confirm') }, confirmLabel);
    const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-title' },
      h('h3', { id: 'dlg-title' }, title), h('p', {}, body),
      field && h('p', { class: 'dialog-confirm' }, h('label', {}, `Type "${requireText}" to confirm`), field),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => dialog.close('cancel') }, 'Cancel'), confirm));
    dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'confirm'); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
    (field || confirm).focus();
  });
}
