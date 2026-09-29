import * as api from './api.js';
import { renderConfig } from './config.js';
import { renderCustomers } from './customers.js';
import { clear, errorBox, h } from './dom.js';
import { renderOverview } from './overview.js';

const IDLE_MS = 15 * 60 * 1000;
const TABS = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'customers', label: 'Customers', render: renderCustomers },
  { id: 'config', label: 'Configuration', render: renderConfig },
];

const app = document.getElementById('app');
let idleTimer;
let inApp = false;

function showLogin(message) {
  inApp = false;
  document.querySelectorAll('dialog').forEach((d) => d.close()); // a confirm dialog must not outlive the unlocked session
  clearTimeout(idleTimer);
  const error = h('div', {}, message && errorBox(message));
  const input = h('input', { id: 'key', type: 'password', autocomplete: 'new-password', required: true, placeholder: 'sk_…' });
  const button = h('button', { class: 'btn', type: 'submit' }, 'Unlock');

  const submit = async (e) => {
    e.preventDefault();
    const key = input.value.trim();
    input.value = '';
    if (!key.startsWith('sk_')) return clear(error).append(errorBox('That is not a secret key. Use a v2 secret key (sk_…), not a public SDK key.'));

    button.disabled = true;
    api.unlock(key);
    try {
      await api.getOverview(); // cheap read that proves the key is valid for this project
      showApp();
    } catch (err) {
      api.lock();
      button.disabled = false;
      clear(error).append(errorBox(err.status === 401 ? 'RevenueCat rejected this key.' : err));
    }
  };

  clear(app).append(h('form', { class: 'login card', onsubmit: submit },
    h('h1', {}, 'Admin'),
    h('p', { class: 'muted' }, 'Enter a RevenueCat v2 secret key for the Fahrtenbuch project. It stays in this tab’s memory only and is forgotten on reload or after 15 idle minutes.'),
    h('label', { for: 'key' }, 'Secret API key'), input, error, button));
  input.focus();
}

function showApp() {
  inApp = true;
  const content = h('div');
  const tabButtons = TABS.map((tab) => h('button', { type: 'button', role: 'tab', onclick: () => select(tab) }, tab.label));

  function select(tab) {
    tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(TABS[i] === tab)));
    clear(content);
    tab.render(content);
  }

  clear(app).append(
    h('div', { class: 'toolbar' }, h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections' }, tabButtons),
      h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => lock() }, 'Lock')),
    content);
  select(TABS[0]);
  armIdleTimer();
}

function lock(message) {
  api.lock();
  showLogin(message);
}

function armIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => lock('Locked after 15 minutes of inactivity.'), IDLE_MS);
}

for (const type of ['pointerdown', 'keydown', 'scroll']) {
  addEventListener(type, () => inApp && armIdleTimer(), { passive: true });
}
api.onKeyRejected(() => inApp && showLogin('RevenueCat rejected the key – it may have been revoked.'));

showLogin();
