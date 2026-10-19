const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { parse } = require('csv-parse/sync');
const crypto = require('crypto');
const { Ticket, User, KBArticle, CannedResponse } = require('../models');
const { auth, can } = require('../middleware/auth');
const S = require('../services/ticketService');
const { findSimilar } = require('../services/similarity');
const { classify } = require('../services/classifier');
const { estimateHours } = require('../services/stats');
const { draftReply } = require('../services/llm');
const { computeDue } = require('../services/sla');
const { audit } = require('../services/audit');
const { str, csvCell, isId } = require('../utils');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: (r, f, cb) => cb(null, UPLOAD_DIR), filename: (r, f, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(f.originalname).toLowerCase()) }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (r, f, cb) => cb(/\.(png|jpe?g|gif|webp|pdf|txt|log|csv|docx?|xlsx?)$/i.test(f.originalname) ? null : new Error('File type not allowed'), /\.(png|jpe?g|gif|webp|pdf|txt|log|csv|docx?|xlsx?)$/i.test(f.originalname))
});
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(auth);
router.use((req, res, next) => { Object.keys(req.query).forEach(k => typeof req.query[k] !== 'string' && delete req.query[k]); next(); });

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'], PRIOS = ['low', 'medium', 'high', 'urgent'];
const SORTS = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, updated: { updatedAt: -1 }, priority: { priorityWeight: -1, createdAt: -1 }, smart: { priorityWeight: -1, 'sla.dueAt': 1 }, due: { 'sla.dueAt': 1 } };

function buildQuery(req) {
  const q = req.query, f = { org: req.user.org, deleted: false, archived: q.archived === 'true' };
  if (!req.can('ticket:view_all')) f.requester = req.user._id; else if (isId(q.requester)) f.requester = q.requester;
  if (q.status) f.status = { $in: q.status.split(',') };
  if (q.priority) f.priority = { $in: q.priority.split(',') };
  if (q.category) f.category = q.category;
  if (isId(q.department)) f.department = q.department;
  if (q.tag) f.tags = q.tag;
  if (q.assignee === 'me' || q.mine === 'true') f.assignee = req.user._id;
  else if (q.assignee === 'unassigned') f.assignee = null;
  else if (isId(q.assignee)) f.assignee = q.assignee;
  if (q.from || q.to) f.createdAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to + 'T23:59:59') }) };
  if (q.breached === 'true') { f.status = { $in: ['open', 'in_progress'] }; f['sla.dueAt'] = { $lt: new Date() }; }
  if (q.q && q.q.trim()) {
    const s = q.q.trim();
    if (/^(tkt-?)?\d+$/i.test(s)) f.number = parseInt(s.replace(/\D/g, ''), 10); else f.$text = { $search: s.slice(0, 200) };
  }
  return f;
}
async function load(req, res) {
  const t = await Ticket.findOne({ _id: req.params.id, org: req.user.org });
  if (!t || (t.deleted && !req.can('ticket:delete'))) { res.status(404).json({ message: 'Ticket not found' }); return null; }
  if (!req.can('ticket:view_all') && String(t.requester) !== String(req.user._id)) { res.status(403).json({ message: 'Not your ticket' }); return null; }
  return t;
}
const cleanCF = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k]) => k && !/[.$]/.test(k)).map(([k, v]) => [k, String(v).slice(0, 200)]));

// ---- list / create ----
router.get('/', async (req, res) => {
  const f = buildQuery(req), page = Math.max(1, +req.query.page || 1), limit = Math.min(100, +req.query.limit || 15);
  const sort = f.$text ? { score: { $meta: 'textScore' } } : SORTS[req.query.sort] || SORTS.newest;
  const [items, total] = await Promise.all([
    Ticket.find(f, f.$text ? { score: { $meta: 'textScore' } } : undefined).select('-comments -history -timeLogs -description').sort(sort).skip((page - 1) * limit).limit(limit).populate('requester assignee', 'name email'),
    Ticket.countDocuments(f)]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
});

router.post('/', can('ticket:create'), upload.array('attachments', 5), async (req, res) => {
  const b = req.body, title = str(b.title, 200), description = str(b.description, 10000);
  if (!title || !description) return res.status(400).json({ message: 'Title and description are required' });
  let cf = {}; try { cf = b.customFields ? JSON.parse(b.customFields) : {}; } catch { /* ignore */ }
  const files = (req.files || []).map(f => ({ name: f.originalname, url: '/uploads/' + f.filename, size: f.size }));
  const t = await S.createTicket({
    org: req.user.org, requester: req.user._id, files,
    data: { title, description, category: req.settings.categories.includes(b.category) ? b.category : undefined, priority: PRIOS.includes(b.priority) ? b.priority : undefined, tags: str(b.tags, 300).split(',').map(s => s.trim()).filter(Boolean).slice(0, 8), customFields: cleanCF(cf) }
  });
  res.status(201).json(t);
});

// AI helper for the "new ticket" form: classification, duplicates, KB articles, estimate
router.post('/suggest', can('ticket:create'), async (req, res) => {
  const title = str(req.body.title, 200), description = str(req.body.description, 2000), text = `${title} ${description}`.trim();
  const ai = await classify(text);
  const cat = req.settings.categories.includes(req.body.category) ? req.body.category : ai.category, pr = PRIOS.includes(req.body.priority) ? req.body.priority : ai.priority;
  const [duplicates, kb, estimate] = await Promise.all([
    findSimilar(req.user.org, text, { statuses: ['open', 'in_progress'], limit: 3, requester: req.can('ticket:view_all') ? undefined : req.user._id }),
    text.length > 3 ? KBArticle.find({ org: req.user.org, published: true, $text: { $search: text } }, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(3).select('title category') : [],
    estimateHours(req.user.org, cat, pr)]);
  res.json({ classification: ai, duplicates, kb, estimate });
});

// ---- export / import / bulk ----
router.get('/export', can('ticket:view_all'), async (req, res) => {
  const items = await Ticket.find(buildQuery(req)).sort('-createdAt').limit(5000).populate('requester assignee', 'name email').lean();
  await audit(req, 'export', 'ticket', '', { count: items.length, format: req.query.format });
  if (req.query.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename=tickets.pdf');
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' }); doc.pipe(res);
    doc.fontSize(16).text('Ticket report', { underline: true }).fontSize(9).text(`Generated ${new Date().toISOString()} - ${items.length} tickets`).moveDown();
    items.forEach(t => doc.fontSize(8).text(`${t.code} | ${t.status} | ${t.priority} | ${t.category} | ${t.assignee?.name || 'unassigned'} | ${t.requester?.name || ''} | ${t.createdAt.toISOString().slice(0, 10)} | ${t.title.slice(0, 80)}`));
    return doc.end();
  }
  const head = ['code', 'title', 'status', 'priority', 'category', 'assignee', 'requester', 'created', 'resolved', 'sla_due', 'sla_breached', 'rating', 'minutes_logged'];
  const rows = items.map(t => [t.code, t.title, t.status, t.priority, t.category, t.assignee?.name, t.requester?.name, t.createdAt.toISOString(), t.resolvedAt?.toISOString(), t.sla?.dueAt?.toISOString(), t.sla?.breached, t.feedback?.rating, (t.timeLogs || []).reduce((s, l) => s + l.minutes, 0)]);
  res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename=tickets.csv');
  res.send([head, ...rows].map(r => r.map(csvCell).join(',')).join('\n'));
});

router.post('/import', can('settings:manage'), memUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'CSV file required' });
  let rows;
  try { rows = parse(req.file.buffer, { columns: h => h.map(x => x.trim().toLowerCase()), skip_empty_lines: true, bom: true, relax_column_count: true }); } catch (e) { return res.status(400).json({ message: 'Invalid CSV: ' + e.message }); }
  let ok = 0; const errors = [];
  for (const [i, r] of rows.slice(0, 2000).entries()) {
    try {
      const email = str(r.requester_email || r.email, 120).toLowerCase();
      if (!r.title || !r.description || !/^\S+@\S+$/.test(email)) throw new Error('title, description, requester_email required');
      let u = await User.findOne({ email });
      if (u && String(u.org) !== String(req.user.org)) throw new Error('email belongs to another organization');
      if (!u) u = await User.create({ org: req.user.org, name: email.split('@')[0], email, password: crypto.randomBytes(12).toString('hex') });
      const t = await S.createTicket({ org: req.user.org, requester: u._id, source: 'import', silent: true, data: { title: str(r.title, 200), description: str(r.description, 10000), category: req.settings.categories.includes(r.category) ? r.category : undefined, priority: PRIOS.includes(r.priority) ? r.priority : undefined, createdAt: r.created && !isNaN(new Date(r.created)) ? new Date(r.created) : undefined } });
      if (STATUSES.includes(r.status) && r.status !== 'open') { t.status = r.status; if (['resolved', 'closed'].includes(r.status)) t.resolvedAt = new Date(); await t.save(); }
      ok++;
    } catch (e) { errors.push(`row ${i + 2}: ${e.message}`); }
  }
  await audit(req, 'import', 'ticket', '', { imported: ok, failed: errors.length });
  res.json({ imported: ok, failed: errors.length, errors: errors.slice(0, 10) });
});

router.post('/bulk', can('ticket:update'), async (req, res) => {
  const { action, value } = req.body, ids = Array.isArray(req.body.ids) ? req.body.ids.filter(isId).slice(0, 200) : [];
  if (!ids.length) return res.status(400).json({ message: 'Select at least one ticket' });
  if (action === 'assign' && !req.can('ticket:assign')) return res.status(403).json({ message: 'No permission to assign' });
  if (action === 'delete' && !req.can('ticket:delete')) return res.status(403).json({ message: 'No permission to delete' });
  const tickets = await Ticket.find({ _id: { $in: ids }, org: req.user.org, deleted: false });
  for (const t of tickets) {
    if (action === 'assign') await S.assign(t, isId(value) ? value : null, req.user);
    else if (action === 'status' && STATUSES.includes(value)) await S.setStatus(t, value, req.user);
    else if (action === 'tag' && str(value, 30)) { t.tags = [...new Set([...t.tags, str(value, 30)])]; await t.save(); }
    else if (action === 'archive') { t.archived = true; await t.save(); }
    else if (action === 'delete') { t.deleted = true; t.deletedAt = new Date(); await t.save(); }
  }
  await audit(req, 'bulk_' + action, 'ticket', '', { count: tickets.length, value });
  res.json({ updated: tickets.length });
});

// ---- single ticket ----
router.get('/:id', async (req, res) => {
  const t = await load(req, res); if (!t) return;
  await t.populate([{ path: 'requester assignee', select: 'name email role' }, { path: 'department', select: 'name' }, { path: 'comments.author comments.mentions', select: 'name role' }, { path: 'history.by', select: 'name' }, { path: 'links mergedInto', select: 'code title status' }, { path: 'timeLogs.user', select: 'name' }]);
  const o = t.toObject();
  if (!req.can('ticket:internal')) o.comments = o.comments.filter(c => !c.internal);
  res.json({ ...o, customFields: Object.fromEntries(t.customFields || []) });
});

router.put('/:id', can('ticket:update'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  const b = req.body;
  if (b.title) { S.log(t, req.user._id, 'title', t.title, str(b.title, 200)); t.title = str(b.title, 200); }
  if (b.description) t.description = str(b.description, 10000);
  if (req.settings.categories.includes(b.category) && b.category !== t.category) { S.log(t, req.user._id, 'category', t.category, b.category); t.category = b.category; }
  if (PRIOS.includes(b.priority) && b.priority !== t.priority) {
    S.log(t, req.user._id, 'priority', t.priority, b.priority); t.priority = b.priority; t.priorityWeight = S.weightFor(b.priority, t.sentiment);
    t.sla.dueAt = computeDue(req.settings, b.priority, t.createdAt); t.sla.breached = t.sla.dueAt < new Date() && S.OPEN.includes(t.status);
  }
  if (Array.isArray(b.tags)) t.tags = [...new Set(b.tags.map(x => str(x, 30)).filter(Boolean))].slice(0, 10);
  if (isId(b.department)) t.department = b.department;
  if (b.customFields) t.customFields = cleanCF(b.customFields);
  t.lastActivityAt = new Date(); await t.save(); await S.afterChange(t, 'ticket.updated');
  res.json(t);
});

router.post('/:id/status', async (req, res) => {
  const t = await load(req, res); if (!t) return;
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ message: 'Invalid status' });
  if (!req.can('ticket:update')) { // customers may only close a resolved ticket or reopen it
    const ok = (status === 'closed' && t.status === 'resolved') || (status === 'open' && S.DONE.includes(t.status));
    if (!ok) return res.status(403).json({ message: 'You can only close a resolved ticket or reopen it' });
  }
  res.json(await S.setStatus(t, status, req.user));
});
router.post('/:id/reopen', async (req, res) => {
  const t = await load(req, res); if (!t) return;
  if (!S.DONE.includes(t.status)) return res.status(400).json({ message: 'Ticket is not resolved' });
  res.json(await S.setStatus(t, 'open', req.user));
});
router.post('/:id/assign', can('ticket:assign'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  if (req.body.assignee && !(await User.exists({ _id: req.body.assignee, org: req.user.org, role: { $in: ['agent', 'admin'] } }))) return res.status(400).json({ message: 'Invalid agent' });
  res.json(await S.assign(t, req.body.assignee || null, req.user));
});
router.post('/:id/comments', async (req, res) => {
  const t = await load(req, res); if (!t) return;
  const body = str(req.body.body, 5000); if (!body) return res.status(400).json({ message: 'Comment cannot be empty' });
  const internal = !!req.body.internal && req.can('ticket:internal');
  const mentions = Array.isArray(req.body.mentions) ? req.body.mentions.filter(isId) : [];
  const valid = mentions.length ? (await User.find({ _id: { $in: mentions }, org: req.user.org }).select('_id')).map(u => u._id) : [];
  await S.addComment(t, req.user, { body, internal, mentions: valid });
  res.status(201).json({ ok: true });
});
router.post('/:id/feedback', async (req, res) => {
  const t = await load(req, res); if (!t) return;
  if (String(t.requester) !== String(req.user._id)) return res.status(403).json({ message: 'Only the requester can rate' });
  if (!S.DONE.includes(t.status)) return res.status(400).json({ message: 'You can rate once the ticket is resolved' });
  const rating = +req.body.rating; if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Rating must be 1-5' });
  t.feedback = { rating, comment: str(req.body.comment, 1000), at: new Date() }; t.history.push({ by: req.user._id, action: 'feedback', to: String(rating) });
  await t.save(); await S.afterChange(t); res.json(t.feedback);
});
router.post('/:id/time', can('ticket:update'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  const minutes = Math.round(+req.body.minutes); if (!(minutes >= 1 && minutes <= 1440)) return res.status(400).json({ message: 'Minutes must be 1-1440' });
  t.timeLogs.push({ user: req.user._id, minutes, note: str(req.body.note, 200) }); await t.save(); res.status(201).json({ ok: true });
});
router.post('/:id/link', can('ticket:update'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  const other = await Ticket.findOne({ $or: [{ _id: isId(req.body.target) ? req.body.target : null }, { code: str(req.body.target, 20).toUpperCase() }], org: req.user.org });
  if (!other || other.id === t.id) return res.status(400).json({ message: 'Target ticket not found' });
  await Ticket.updateOne({ _id: t._id }, { $addToSet: { links: other._id } }); await Ticket.updateOne({ _id: other._id }, { $addToSet: { links: t._id } });
  res.json({ ok: true });
});
router.delete('/:id/link/:other', can('ticket:update'), async (req, res) => {
  const t = await load(req, res); if (!t || !isId(req.params.other)) return;
  await Ticket.updateOne({ _id: t._id }, { $pull: { links: req.params.other } }); await Ticket.updateOne({ _id: req.params.other, org: req.user.org }, { $pull: { links: t._id } });
  res.json({ ok: true });
});
router.post('/:id/merge', can('ticket:update'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  const target = await Ticket.findOne({ $or: [{ _id: isId(req.body.target) ? req.body.target : null }, { code: str(req.body.target, 20).toUpperCase() }], org: req.user.org, deleted: false });
  if (!target || target.id === t.id) return res.status(400).json({ message: 'Target ticket not found' });
  target.comments.push({ author: req.user._id, internal: true, body: `Merged from ${t.code}: ${t.title}\n\n${t.description}` });
  t.comments.filter(c => !c.internal).forEach(c => target.comments.push({ author: c.author, internal: false, body: `[${t.code}] ${c.body}` }));
  target.history.push({ by: req.user._id, action: 'merged_in', from: t.code }); await target.save();
  t.mergedInto = target._id; await S.setStatus(t, 'closed', req.user);
  await audit(req, 'merge', 'ticket', t._id, { into: target.code });
  res.json({ merged: true, into: target._id });
});
router.get('/:id/suggestions', can('ticket:internal'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  const similar = await findSimilar(req.user.org, `${t.title} ${t.description}`, { exclude: t._id, limit: 5 });
  const done = await Ticket.find({ _id: { $in: similar.filter(s => S.DONE.includes(s.status)).map(s => s._id) } }).select('code requester comments').lean();
  const replies = done.map(d => { const c = [...d.comments].reverse().find(c => !c.internal && String(c.author) !== String(d.requester)); return c && { from: d.code, body: c.body }; }).filter(Boolean);
  const canned = await CannedResponse.find({ org: req.user.org, $or: [{ category: t.category }, { category: '' }, { category: null }] }).limit(5).select('title body');
  res.json({ similar, replies, canned, llm: await draftReply(t) });
});
router.delete('/:id', can('ticket:delete'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  t.deleted = true; t.deletedAt = new Date(); await t.save(); await audit(req, 'soft_delete', 'ticket', t._id, { code: t.code }); await S.afterChange(t);
  res.json({ deleted: true });
});
router.post('/:id/restore', can('ticket:delete'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  t.deleted = false; t.deletedAt = undefined; t.archived = false; await t.save(); await audit(req, 'restore', 'ticket', t._id, { code: t.code }); await S.afterChange(t);
  res.json({ restored: true });
});
router.post('/:id/archive', can('ticket:update'), async (req, res) => {
  const t = await load(req, res); if (!t) return;
  t.archived = !t.archived; await t.save(); await S.afterChange(t); res.json({ archived: t.archived });
});
module.exports = router;
