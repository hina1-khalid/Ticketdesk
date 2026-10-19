const router = require('express').Router();
const crypto = require('crypto');
const { Department, CannedResponse, AutomationRule, Webhook, KBArticle, SavedFilter, ApiKey, AuditLog } = require('../models');
const { auth, can } = require('../middleware/auth');
const { updateSettings } = require('../services/settings');
const { audit } = require('../services/audit');
const { effective, PERMS, ROLES } = require('../permissions');
const { pick, str } = require('../utils');
router.use(auth);

// Generic org-scoped CRUD
function crud(path, Model, { read, write, fields, sort = '-createdAt' }) {
  const r = require('express').Router();
  r.get('/', (q, s, n) => (!read || q.can(read) ? n() : s.status(403).json({ message: 'No permission' })), async (req, res) => res.json(await Model.find({ org: req.user.org }).sort(sort).limit(500)));
  r.post('/', can(write), async (req, res) => { const d = await Model.create({ ...pick(req.body, fields), org: req.user.org }); await audit(req, 'create', path, d._id); res.status(201).json(d); });
  r.put('/:id', can(write), async (req, res) => { const d = await Model.findOneAndUpdate({ _id: req.params.id, org: req.user.org }, pick(req.body, fields), { new: true, runValidators: true }); if (!d) return res.status(404).json({ message: 'Not found' }); await audit(req, 'update', path, d._id); res.json(d); });
  r.delete('/:id', can(write), async (req, res) => { await Model.deleteOne({ _id: req.params.id, org: req.user.org }); await audit(req, 'delete', path, req.params.id); res.json({ deleted: true }); });
  router.use('/' + path, r);
}
crud('departments', Department, { write: 'settings:manage', fields: ['name', 'categories'], sort: 'name' });
crud('canned', CannedResponse, { read: 'canned:use', write: 'settings:manage', fields: ['title', 'body', 'category'], sort: 'title' });
crud('automation', AutomationRule, { read: 'automation:manage', write: 'automation:manage', fields: ['name', 'active', 'trigger', 'idleHours', 'conditions', 'actions'] });
crud('webhooks', Webhook, { read: 'apikey:manage', write: 'apikey:manage', fields: ['url', 'events', 'secret', 'active'] });
crud('kb-admin', KBArticle, { read: 'kb:manage', write: 'kb:manage', fields: ['title', 'body', 'category', 'tags', 'published'] });

// Settings (categories, SLA, business hours, holidays, custom fields, permissions)
router.get('/settings', async (req, res) => {
  const s = req.settings;
  const base = { categories: s.categories, customFields: s.customFields, slaHours: s.slaHours };
  if (!req.can('settings:manage')) return res.json({ ...base, departments: await Department.find({ org: req.user.org }).select('name categories') });
  res.json({ ...base, businessHours: s.businessHours, holidays: s.holidays, autoArchiveDays: s.autoArchiveDays, permissions: effective(s.permissions), allPermissions: PERMS, roles: ROLES, departments: await Department.find({ org: req.user.org }).select('name categories') });
});
router.put('/settings', can('settings:manage'), async (req, res) => {
  const b = req.body, patch = {};
  if (Array.isArray(b.categories)) patch.categories = [...new Set(b.categories.map(x => str(x, 40)).filter(Boolean))].slice(0, 30);
  if (b.slaHours) patch.slaHours = Object.fromEntries(['low', 'medium', 'high', 'urgent'].map(k => [k, Math.max(0.5, +b.slaHours[k] || 24)]));
  if (b.businessHours) { const h = b.businessHours; patch.businessHours = { enabled: !!h.enabled, startHour: Math.min(23, Math.max(0, +h.startHour || 9)), endHour: Math.min(24, Math.max(1, +h.endHour || 18)), days: (h.days || []).map(Number).filter(d => d >= 0 && d <= 6), utcOffsetMinutes: +h.utcOffsetMinutes || 0 }; }
  if (Array.isArray(b.holidays)) patch.holidays = b.holidays.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (Array.isArray(b.customFields)) patch.customFields = b.customFields.filter(c => c.key && c.label).map(c => ({ category: str(c.category, 40), key: str(c.key, 30).replace(/[.$\s]/g, ''), label: str(c.label, 50) }));
  if (b.autoArchiveDays !== undefined) patch.autoArchiveDays = Math.max(0, +b.autoArchiveDays || 0);
  if (b.permissions && typeof b.permissions === 'object') patch.permissions = Object.fromEntries(ROLES.filter(r => r !== 'admin' && Array.isArray(b.permissions[r])).map(r => [r, b.permissions[r].filter(p => PERMS.includes(p))]));
  await updateSettings(req.user.org, patch); await audit(req, 'update', 'settings', '', { keys: Object.keys(patch) });
  res.json({ saved: true });
});

// Saved filters
router.get('/filters', async (req, res) => res.json(await SavedFilter.find({ user: req.user._id }).sort('name')));
router.post('/filters', async (req, res) => { const q = req.body.query && typeof req.body.query === 'object' ? Object.fromEntries(Object.entries(req.body.query).filter(([k, v]) => typeof v === 'string' && k !== 'page')) : {}; res.status(201).json(await SavedFilter.create({ org: req.user.org, user: req.user._id, name: str(req.body.name, 40) || 'My view', query: q })); });
router.delete('/filters/:id', async (req, res) => { await SavedFilter.deleteOne({ _id: req.params.id, user: req.user._id }); res.json({ deleted: true }); });

// API keys (raw key is shown once)
router.get('/apikeys', can('apikey:manage'), async (req, res) => res.json(await ApiKey.find({ org: req.user.org }).select('-hash').sort('-createdAt')));
router.post('/apikeys', can('apikey:manage'), async (req, res) => {
  const raw = 'td_' + crypto.randomBytes(24).toString('hex');
  const k = await ApiKey.create({ org: req.user.org, name: str(req.body.name, 50) || 'API key', prefix: raw.slice(0, 8), hash: crypto.createHash('sha256').update(raw).digest('hex') });
  await audit(req, 'create', 'apikey', k._id); res.status(201).json({ id: k._id, name: k.name, key: raw });
});
router.delete('/apikeys/:id', can('apikey:manage'), async (req, res) => { await ApiKey.deleteOne({ _id: req.params.id, org: req.user.org }); await audit(req, 'delete', 'apikey', req.params.id); res.json({ deleted: true }); });

router.get('/audit', can('audit:view'), async (req, res) => {
  const page = Math.max(1, +req.query.page || 1);
  const [items, total] = await Promise.all([AuditLog.find({ org: req.user.org }).sort('-createdAt').skip((page - 1) * 30).limit(30).populate('user', 'name'), AuditLog.countDocuments({ org: req.user.org })]);
  res.json({ items, total, pages: Math.ceil(total / 30) || 1 });
});
module.exports = router;
