const router = require('express').Router();
const { Ticket, User } = require('../models');
const { auth, can } = require('../middleware/auth');
const cache = require('../services/cache');
const stats = require('../services/stats');
const { str } = require('../utils');
router.use(auth);

router.get('/overview', async (req, res) => {
  const all = req.can('ticket:view_all') || req.can('report:view');
  const scope = all ? { org: req.user.org } : { org: req.user.org, requester: req.user._id };
  res.json(await cache.wrap(`stats:${req.user.org}:${all ? 'all' : req.user._id}`, 60, async () => {
    const base = { ...scope, deleted: false };
    const grp = f => Ticket.aggregate([{ $match: base }, { $group: { _id: '$' + f, count: { $sum: 1 } } }]);
    const since = new Date(Date.now() - 30 * 864e5);
    const [st, pr, cat, resolved, csat, breached, perDay] = await Promise.all([
      grp('status'), grp('priority'), grp('category'),
      Ticket.aggregate([{ $match: { ...base, resolvedAt: { $ne: null } } }, { $group: { _id: null, ms: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } }]),
      Ticket.aggregate([{ $match: { ...base, 'feedback.rating': { $exists: true } } }, { $group: { _id: null, avg: { $avg: '$feedback.rating' }, n: { $sum: 1 }, sat: { $sum: { $cond: [{ $gte: ['$feedback.rating', 4] }, 1, 0] } } } }]),
      Ticket.countDocuments({ ...base, status: { $in: ['open', 'in_progress'] }, 'sla.dueAt': { $lt: new Date() } }),
      Ticket.aggregate([{ $match: { ...base, createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }])]);
    const m = a => Object.fromEntries(a.map(x => [x._id, x.count]));
    const dm = m(perDay), days = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push({ date: d.slice(5), count: dm[d] || 0 }); }
    const s = m(st), c = csat[0];
    return { total: st.reduce((a, x) => a + x.count, 0), open: (s.open || 0) + (s.in_progress || 0), resolved: (s.resolved || 0) + (s.closed || 0), breached, byStatus: s, byPriority: m(pr), byCategory: m(cat), perDay: days,
      avgResolutionHours: resolved[0] ? +(resolved[0].ms / 36e5).toFixed(1) : null, csat: c ? { avg: +c.avg.toFixed(2), responses: c.n, percent: Math.round((c.sat / c.n) * 100) } : { avg: null, responses: 0, percent: null } };
  }));
});

router.get('/agents', can('report:view'), async (req, res) => {
  const org = req.user.org;
  const rows = await Ticket.aggregate([{ $match: { org, deleted: false, assignee: { $ne: null } } }, { $group: { _id: '$assignee', assigned: { $sum: 1 },
    open: { $sum: { $cond: [{ $in: ['$status', ['open', 'in_progress']] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } },
    breached: { $sum: { $cond: ['$sla.breached', 1, 0] } }, avgMs: { $avg: { $cond: [{ $ifNull: ['$resolvedAt', false] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } },
    rating: { $avg: '$feedback.rating' }, minutes: { $sum: { $sum: '$timeLogs.minutes' } } } }]);
  const m = Object.fromEntries(rows.map(r => [String(r._id), r]));
  const agents = await User.find({ org, role: { $in: ['agent', 'admin'] }, active: true }).select('name role');
  res.json(agents.map(a => { const r = m[String(a._id)] || {}; return { id: a._id, name: a.name, assigned: r.assigned || 0, open: r.open || 0, resolved: r.resolved || 0, breached: r.breached || 0, avgResolutionHours: r.avgMs ? +(r.avgMs / 36e5).toFixed(1) : null, avgRating: r.rating ? +r.rating.toFixed(2) : null, minutesLogged: r.minutes || 0 }; }));
});
router.get('/forecast', can('report:view'), async (req, res) => res.json(await stats.forecast(req.user.org)));
router.get('/anomalies', can('report:view'), async (req, res) => res.json({ now: await stats.hourlyAnomaly(req.user.org), daily: await stats.dailyAnomalies(req.user.org) }));
router.post('/predict', async (req, res) => res.json(await stats.estimateHours(req.user.org, str(req.body.category), str(req.body.priority))));
module.exports = router;
