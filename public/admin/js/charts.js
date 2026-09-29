// Dependency-free SVG line chart. Styling is class-based (CSP forbids inline style attributes).

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
};

const W = 640, H = 200, PAD = { top: 12, right: 12, bottom: 26, left: 44 };

/** Turns a chart response into { name, unit, points: [{ t, value, incomplete }] } for its first chartable measure. */
export function toSeries(chart) {
  const measures = chart.measures ?? [];
  const index = Math.max(0, measures.findIndex((m) => m.chartable !== false));
  const points = (chart.values ?? [])
    .filter((v) => v.measure === index)
    .map((v) => ({ t: v.cohort * 1000, value: v.value, incomplete: !!v.incomplete }))
    .sort((a, b) => a.t - b.t);
  return { name: measures[index]?.display_name ?? chart.display_name, unit: measures[index]?.unit ?? '#', points };
}

export function niceMax(max) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function lineChart({ points }, { format, dateLabel }) {
  const top = niceMax(Math.max(...points.map((p) => p.value), 0));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (v / top) * plotH;

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart' });

  for (const f of [0, 0.5, 1]) {
    const gy = y(top * f);
    root.append(
      svg('line', { class: 'ch-grid', x1: PAD.left, x2: W - PAD.right, y1: gy, y2: gy }),
      Object.assign(svg('text', { class: 'ch-txt', x: PAD.left - 8, y: gy + 4, 'text-anchor': 'end' }), { textContent: format(top * f) }),
    );
  }

  const coords = points.map((p, i) => `${x(i)},${y(p.value)}`);
  root.append(
    svg('polygon', { class: 'ch-area', points: `${x(0)},${y(0)} ${coords.join(' ')} ${x(points.length - 1)},${y(0)}` }),
    svg('polyline', { class: 'ch-line', points: coords.join(' ') }),
  );

  points.forEach((p, i) => {
    const dot = svg('circle', { class: p.incomplete ? 'ch-dot ch-dot-open' : 'ch-dot', cx: x(i), cy: y(p.value), r: points.length > 45 ? 0 : 3 });
    const hit = svg('circle', { class: 'ch-hit', cx: x(i), cy: y(p.value), r: 9 });
    const tip = svg('title');
    tip.textContent = `${dateLabel(p.t)}: ${format(p.value)}${p.incomplete ? ' (period in progress)' : ''}`;
    hit.append(tip);
    root.append(dot, hit);
  });

  for (const i of new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])) {
    const label = svg('text', { class: 'ch-txt', x: x(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle' });
    label.textContent = dateLabel(points[i].t);
    root.append(label);
  }
  return root;
}
