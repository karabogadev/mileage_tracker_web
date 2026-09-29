// Tiny DOM + formatting helpers. Everything is built with textContent/createElement – API data is never parsed as HTML.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key in el && key !== 'list') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

export const clear = (el) => { el.replaceChildren(); return el; };

const numberFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function formatValue(value, unit, currency = 'USD') {
  if (value == null) return '–';
  if (unit === '$') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
  }
  if (unit === '%') return `${numberFmt.format(value)}%`;
  return numberFmt.format(value);
}

// RevenueCat sends timestamps as ms since epoch (customers, subscriptions) or ISO strings (a few list fields).
const formatWith = (fmt) => (v) => (v == null ? '–' : fmt.format(new Date(v)));
export const formatDate = formatWith(dateFmt);
export const formatDateTime = formatWith(dateTimeFmt);

export const DAY_MS = 864e5;

export function badge(text, tone = 'neutral') {
  return h('span', { class: tone === 'neutral' ? 'badge' : `badge badge-${tone}` }, text);
}

export function emptyState(text) {
  return h('p', { class: 'empty muted' }, text);
}

export function errorBox(err) {
  const detail = err?.requestId ? ` (request ${err.requestId})` : '';
  return h('div', { class: 'notice-error', role: 'alert' }, `${err?.message ?? err}${detail}`);
}

const rowsOf = (rows) => rows.map((cells) => h('tr', {}, cells.map((c) => h('td', {}, c))));

/** A table, or an empty-state line when there are no rows. Cells may be strings or elements. */
export function table(head, rows, empty = 'None') {
  if (!rows.length) return emptyState(empty);
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, head.map((t) => h('th', {}, t)))),
    h('tbody', {}, rowsOf(rows))));
}

export const appendRows = (tableEl, rows) => tableEl.querySelector('tbody').append(...rowsOf(rows));

/** Shows "Loading…" in `el`, then whatever `render()` returns (a node or array of nodes), or the error. */
export async function load(el, render) {
  clear(el).append(emptyState('Loading…'));
  try {
    const content = await render();
    clear(el).append(...[content].flat());
  } catch (err) {
    clear(el).append(errorBox(err));
  }
}
