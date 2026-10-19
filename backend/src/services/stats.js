const { Ticket } = require('../models');
const weekStart = d => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x; };
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

// Resolution-time prediction: median + 80th percentile of similar resolved tickets (category+priority -> category -> all).
async function estimateHours(org, category, priority) {
  const pick = async m => {
    const rows = await Ticket.find({ org, deleted: false, resolvedAt: { $ne: null }, ...m }).sort('-createdAt').limit(500).select('createdAt resolvedAt').lean();
    const h = rows.map(r => (r.resolvedAt - r.createdAt) / 36e5).filter(x => x >= 0).sort((a, b) => a - b);
    if (h.length < 3) return null;
    const q = p => h[Math.min(h.length - 1, Math.floor(p * h.length))];
    return { hours: +q(0.5).toFixed(1), p80: +q(0.8).toFixed(1), samples: h.length };
  };
  return (await pick({ category, priority })) || (await pick({ category })) || (await pick({})) || { hours: null, p80: null, samples: 0 };
}

// Holt's linear exponential smoothing; alpha/beta are chosen by minimising one-step-ahead squared error.
function holt(y, h = 4) {
  const n = y.length; if (n < 3) return null;
  let best = null;
  for (const a of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const b of [0.05, 0.1, 0.2, 0.4]) {
    let l = y[0], t = (y[n - 1] - y[0]) / (n - 1), sse = 0;
    for (let i = 1; i < n; i++) { const err = y[i] - (l + t); sse += err * err; const ln = a * y[i] + (1 - a) * (l + t); t = b * (ln - l) + (1 - b) * t; l = ln; }
    if (!best || sse < best.sse) best = { a, b, sse, l, t };
  }
  const sd = Math.sqrt(best.sse / (n - 1));
  return { alpha: best.a, beta: best.b, sd, points: Array.from({ length: h }, (_, k) => { const f = best.l + (k + 1) * best.t, w = 1.28 * sd * Math.sqrt(k + 1); return { count: Math.max(0, Math.round(f)), low: Math.max(0, Math.round(f - w)), high: Math.max(0, Math.round(f + w)) }; }) };
}

// Spike detection: last 3h vs previous 69h (z-score).
async function hourlyAnomaly(org) {
  const since = new Date(Date.now() - 72 * 36e5);
  const dates = (await Ticket.find({ org, createdAt: { $gte: since } }).select('createdAt').lean()).map(t => t.createdAt.getTime());
  const counts = Array(72).fill(0), now = Date.now();
  dates.forEach(d => { const i = Math.floor((now - d) / 36e5); if (i >= 0 && i < 72) counts[i]++; });
  const recent = counts.slice(0, 3).reduce((a, b) => a + b, 0) / 3, base = counts.slice(3);
  const z = (recent - mean(base)) / (std(base) || 0.5);
  return { recentPerHour: +recent.toFixed(2), baselinePerHour: +mean(base).toFixed(2), z: +z.toFixed(2), anomaly: recent >= 3 && z > 2.5, hourly: counts.slice().reverse() };
}
async function dailyAnomalies(org) {
  const since = new Date(Date.now() - 30 * 864e5);
  const dates = await Ticket.find({ org, createdAt: { $gte: since } }).select('createdAt').lean();
  const days = {};
  for (let i = 29; i >= 0; i--) days[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;
  dates.forEach(t => { const k = t.createdAt.toISOString().slice(0, 10); if (k in days) days[k]++; });
  const vals = Object.values(days), m = mean(vals), s = std(vals) || 0.5;
  return Object.entries(days).map(([date, count]) => ({ date, count, z: +((count - m) / s).toFixed(2), anomaly: (count - m) / s > 2 && count >= 5 }));
}
async function forecast(org) {
  const start = weekStart(new Date(Date.now() - 11 * 7 * 864e5));
  const dates = await Ticket.find({ org, createdAt: { $gte: start } }).select('createdAt').lean();
  const weeks = Array.from({ length: 12 }, (_, i) => ({ week: new Date(start.getTime() + i * 7 * 864e5).toISOString().slice(0, 10), count: 0 }));
  dates.forEach(t => { const w = Math.floor((weekStart(t.createdAt) - start) / (7 * 864e5)); if (weeks[w]) weeks[w].count++; });
  const m = holt(weeks.map(w => w.count), 4);
  const next = (m ? m.points : Array(4).fill({ count: 0, low: 0, high: 0 })).map((p, i) => ({ week: new Date(start.getTime() + (12 + i) * 7 * 864e5).toISOString().slice(0, 10), ...p }));
  return { history: weeks, forecast: next, model: m ? { name: "Holt linear exponential smoothing", alpha: m.alpha, beta: m.beta } : null };
}
module.exports = { estimateHours, hourlyAnomaly, dailyAnomalies, forecast, weekStart, holt };
