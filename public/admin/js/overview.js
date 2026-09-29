import * as api from './api.js';
import { lineChart, toSeries } from './charts.js';
import { DAY_MS, clear, emptyState, formatValue, h, load } from './dom.js';

const CHARTS = [
  { name: 'revenue', title: 'Revenue' },
  { name: 'actives', title: 'Active subscriptions' },
  { name: 'trials', title: 'Active trials' },
  { name: 'customers_new', title: 'New customers' },
  { name: 'trial_conversion_rate', title: 'Trial conversion' },
  { name: 'churn', title: 'Churn' },
];

const RANGES = [
  { days: 7, label: '7 days', resolution: 0 },
  { days: 30, label: '30 days', resolution: 0 },
  { days: 90, label: '90 days', resolution: 1 },
];

const isoDay = (d) => d.toISOString().slice(0, 10);
const dayLabel = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function renderOverview(root) {
  const metrics = h('div', { class: 'metrics' });
  const grid = h('div', { class: 'chart-grid' });
  const range = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Chart range' });
  let selected = RANGES[1];

  const rangeButtons = RANGES.map((r) => h('button', {
    type: 'button',
    'aria-pressed': String(r === selected),
    onclick: () => { selected = r; rangeButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(RANGES[i] === r))); loadCharts(); },
  }, r.label));
  range.append(...rangeButtons);

  root.append(
    h('section', {}, h('h2', {}, 'Last 28 days'), metrics),
    h('section', {}, h('div', { class: 'panel-head' }, h('h2', {}, 'Trends'), range), grid),
  );

  const loadMetrics = () => load(metrics, async () => {
    const data = await api.getOverview();
    return data.metrics.map((m) => h('div', { class: 'metric' },
      h('span', { class: 'metric-label' }, m.name), h('strong', {}, formatValue(m.value, m.unit, data.currency)), h('span', { class: 'muted small' }, m.description)));
  });

  async function loadCharts() {
    const end = new Date();
    const start = new Date(end.getTime() - (selected.days - 1) * DAY_MS);
    const params = { start: isoDay(start), end: isoDay(end), resolution: selected.resolution };

    // Each card loads on its own, so one failing chart (e.g. a missing permission) does not blank the others.
    clear(grid).append(...CHARTS.map((c) => {
      const body = h('div');
      load(body, async () => {
        const series = toSeries(await api.getChart(c.name, params));
        if (!series.points.length) return emptyState('No data in this range');
        const format = (v) => formatValue(v, series.unit);
        return [
          h('p', { class: 'chart-value' }, h('strong', {}, format(series.points.at(-1).value)), h('span', { class: 'muted small' }, ` ${series.name}`)),
          lineChart(series, { format, dateLabel: dayLabel }),
        ];
      });
      return h('article', { class: 'chart-card' }, h('h3', {}, c.title), body);
    }));
  }

  loadMetrics();
  loadCharts();
}
