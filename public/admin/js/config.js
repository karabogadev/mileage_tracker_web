import * as api from './api.js';
import { badge, formatDate, h, load, table } from './dom.js';

const stateBadge = (state) => badge(state ?? '–', state === 'active' ? 'ok' : 'neutral');
const section = (title, content) => h('section', {}, h('h2', {}, title), content);

export function renderConfig(root) {
  // Render into our own box: the response can arrive after the user has switched to another tab.
  const box = h('div');
  root.append(box);

  return load(box, async () => {
    const [apps, products, entitlements, offerings, webhooks] = await Promise.all([
      api.listApps(), api.listProducts(), api.listEntitlements(), api.listOfferings(), api.listWebhooks(),
    ]);

    // [label, passes, optional]: a failing required check is a warning, a failing optional one just informational
    const checks = [
      ['An app is connected', apps.length > 0],
      ['App Store Connect API key is configured', apps.filter((a) => a.type === 'app_store').every((a) => a.app_store?.app_store_connect_api_key_configured)],
      ['At least one active product', products.some((p) => p.state === 'active')],
      ['At least one active entitlement', entitlements.some((e) => e.state === 'active')],
      ['A current offering is set', offerings.some((o) => o.is_current)],
      ['A webhook is configured (optional)', webhooks.length > 0, true],
    ];

    return [
      section('Health', h('ul', { class: 'health' }, checks.map(([label, pass, optional]) =>
        h('li', {}, pass ? badge('OK', 'ok') : optional ? badge('Info') : badge('Check', 'warn'), ` ${label}`)))),
      section('Apps', table(['Name', 'Type', 'Bundle ID'],
        apps.map((a) => [a.name, a.type, a.app_store?.bundle_id ?? a.play_store?.package_name ?? '–']))),
      section('Products', table(['Name', 'Store identifier', 'Type', 'State'],
        products.map((p) => [p.display_name ?? '–', h('code', {}, p.store_identifier), p.type, stateBadge(p.state)]))),
      section('Entitlements', table(['Name', 'Identifier', 'State'],
        entitlements.map((e) => [e.display_name, h('code', {}, e.lookup_key), stateBadge(e.state)]))),
      section('Offerings', table(['Name', 'Identifier', 'Current', 'Paywall', 'Created'],
        offerings.map((o) => [o.display_name, h('code', {}, o.lookup_key), o.is_current ? badge('current', 'ok') : '–', o.paywall_id ? 'attached' : '–', formatDate(o.created_at)]))),
      section('Webhooks', table(['Name', 'URL'], webhooks.map((w) => [w.name ?? '–', h('code', {}, w.url)]), 'None configured')),
    ];
  });
}
