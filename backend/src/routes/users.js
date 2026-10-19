const router = require('express').Router();
const { User, Ticket } = require('../models');
const { auth, can } = require('../middleware/auth');
const { audit } = require('../services/audit');
const { ROLES } = require('../permissions');
const { str, isId } = require('../utils');
router.use(auth);
const pub = u => ({ id: u._id, name: u.name, email: u.email, role: u.role, isSenior: u.isSenior, departments: u.departments, active: u.active, twoFactor: !!u.twoFactor?.enabled, createdAt: u.createdAt });

router.get('/', async (req, res) => {
  if (!req.can('ticket:view_all') && !req.can('user:manage')) return res.status(403).json({ message: 'No permission' });
  const f = { org: req.user.org };
  if (req.query.role) f.role = { $in: String(req.query.role).split(',') };
  res.json((await User.find(f).sort('name').limit(500)).map(pub));
});
router.post('/', can('user:manage'), async (req, res) => {
  const email = str(req.body.email, 120).toLowerCase(), password = str(req.body.password, 100), name = str(req.body.name, 80);
  if (!name || !/^\S+@\S+$/.test(email) || password.length < 8) return res.status(400).json({ message: 'Name, valid email and 8+ char password required' });
  if (await User.exists({ email })) return res.status(409).json({ message: 'Email already registered' });
  const u = await User.create({ org: req.user.org, name, email, password, role: ROLES.includes(req.body.role) ? req.body.role : 'user', isSenior: !!req.body.isSenior });
  await audit(req, 'create', 'user', u._id, { email, role: u.role });
  res.status(201).json(pub(u));
});
router.put('/:id', can('user:manage'), async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, org: req.user.org }); if (!u) return res.status(404).json({ message: 'User not found' });
  const b = req.body;
  if (ROLES.includes(b.role)) { if (String(u._id) === String(req.user._id) && b.role !== 'admin') return res.status(400).json({ message: 'You cannot remove your own admin role' }); u.role = b.role; }
  if (typeof b.isSenior === 'boolean') u.isSenior = b.isSenior;
  if (typeof b.active === 'boolean' && String(u._id) !== String(req.user._id)) u.active = b.active;
  if (b.name) u.name = str(b.name, 80);
  if (Array.isArray(b.departments)) u.departments = b.departments.filter(isId);
  if (str(b.password, 100).length >= 8) u.password = str(b.password, 100);
  await u.save(); await audit(req, 'update', 'user', u._id, { role: u.role, active: u.active });
  res.json(pub(u));
});
// Customer profile page: user + all their tickets
router.get('/:id/profile', can('ticket:view_all'), async (req, res) => {
  const u = await User.findOne({ _id: req.params.id, org: req.user.org }); if (!u) return res.status(404).json({ message: 'User not found' });
  const tickets = await Ticket.find({ org: req.user.org, requester: u._id, deleted: false }).sort('-createdAt').limit(100).select('code title status priority category createdAt feedback.rating');
  const rated = tickets.filter(t => t.feedback?.rating);
  res.json({ user: pub(u), tickets, stats: { total: tickets.length, open: tickets.filter(t => ['open', 'in_progress'].includes(t.status)).length, avgRating: rated.length ? +(rated.reduce((s, t) => s + t.feedback.rating, 0) / rated.length).toFixed(1) : null } });
});
module.exports = router;
