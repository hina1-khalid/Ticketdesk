const router = require('express').Router();
const { Ticket, User, Organization } = require('../models');
const { apiKeyAuth } = require('../middleware/auth');
const env = require('../config/env');
const S = require('../services/ticketService');
const { str, esc } = require('../utils');
const { ingestEmail, ingestWhatsApp } = require('../services/inbound');
const { normPhone, validSignature } = require('../services/whatsapp');
const crypto = require('crypto');

// Track a ticket by its code only (limited, non-sensitive fields)
router.get('/public/track/:code', async (req, res) => {
  const t = await Ticket.findOne({ code: str(req.params.code, 20).toUpperCase(), deleted: false }).select('code title status priority createdAt updatedAt resolvedAt sla.dueAt history');
  if (!t) return res.status(404).json({ message: 'No ticket found with this ID' });
  res.json({ code: t.code, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt, updatedAt: t.updatedAt, resolvedAt: t.resolvedAt, dueAt: t.sla?.dueAt,
    timeline: [{ at: t.createdAt, text: 'Ticket created' }, ...t.history.filter(h => h.field === 'status').map(h => ({ at: h.at, text: `Status changed to ${h.to.replace('_', ' ')}` }))] });
});

// Email-to-ticket: point Mailgun/SendGrid "inbound parse" (or any forwarder) at this endpoint (IMAP polling is also built in)
router.post('/inbound/email', async (req, res) => {
  const secret = req.headers['x-inbound-secret'] || '';
  if (secret.length !== env.inboundSecret.length || !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(env.inboundSecret))) return res.status(401).json({ message: 'Bad secret' });
  const org = await Organization.findOne({ slug: str(req.body.org, 40).toLowerCase() });
  const from = (str(req.body.from, 200).match(/[^\s<>]+@[^\s<>]+/) || [])[0];
  if (!org || !from) return res.status(400).json({ message: 'org (slug) and from are required' });
  try { res.status(201).json(await ingestEmail({ org, from, name: str(req.body.name, 80), subject: str(req.body.subject, 200), text: str(req.body.text, 10000) })); }
  catch (e) { res.status(409).json({ message: e.message }); }
});

// WhatsApp (Twilio webhook): "When a message comes in" -> POST https://YOUR-API/api/inbound/whatsapp
router.post('/inbound/whatsapp', async (req, res) => {
  if (!env.twilio.token) return res.status(503).json({ message: 'WhatsApp is not configured' });
  if (!validSignature(env.publicUrl + '/api/inbound/whatsapp', req.body, String(req.headers['x-twilio-signature'] || ''), env.twilio.token)) return res.status(403).json({ message: 'Bad signature' });
  const org = await Organization.findOne({ slug: env.twilio.orgSlug }), phone = normPhone(str(req.body.From, 40).replace('whatsapp:', ''));
  if (!org || !phone) return res.status(400).json({ message: 'Unknown organization or phone' });
  const out = await ingestWhatsApp({ org, phone, name: str(req.body.ProfileName, 80), body: str(req.body.Body, 4000) });
  res.type('text/xml').send(`<Response><Message>${esc(out.text)}</Message></Response>`);
});

// ---- Public REST API (x-api-key) ----
const v1 = require('express').Router();
v1.use(apiKeyAuth);
const shape = t => ({ code: t.code, title: t.title, description: t.description, status: t.status, priority: t.priority, category: t.category, tags: t.tags, createdAt: t.createdAt, resolvedAt: t.resolvedAt });
v1.get('/tickets', async (req, res) => {
  const f = { org: req.apiOrg, deleted: false }; if (str(req.query.status)) f.status = str(req.query.status);
  res.json((await Ticket.find(f).sort('-createdAt').limit(Math.min(200, +req.query.limit || 50))).map(shape));
});
v1.get('/tickets/:code', async (req, res) => { const t = await Ticket.findOne({ org: req.apiOrg, code: str(req.params.code, 20).toUpperCase(), deleted: false }); t ? res.json(shape(t)) : res.status(404).json({ message: 'Not found' }); });
v1.post('/tickets', async (req, res) => {
  const email = str(req.body.requesterEmail, 120).toLowerCase(), title = str(req.body.title, 200), description = str(req.body.description, 10000);
  if (!title || !description || !/^\S+@\S+$/.test(email)) return res.status(400).json({ message: 'title, description, requesterEmail required' });
  let u = await User.findOne({ email });
  if (u && String(u.org) !== String(req.apiOrg)) return res.status(409).json({ message: 'Requester belongs to another organization' });
  if (!u) u = await User.create({ org: req.apiOrg, name: email.split('@')[0], email, password: crypto.randomBytes(12).toString('hex') });
  const t = await S.createTicket({ org: req.apiOrg, requester: u._id, source: 'api', data: { title, description, category: str(req.body.category) || undefined, priority: ['low', 'medium', 'high', 'urgent'].includes(req.body.priority) ? req.body.priority : undefined } });
  res.status(201).json(shape(t));
});
// Flat dataset for Power BI (Web connector with header x-api-key)
v1.get('/powerbi/tickets', async (req, res) => {
  const items = await Ticket.find({ org: req.apiOrg, deleted: false }).sort('-createdAt').limit(20000).populate('assignee requester', 'name').lean();
  res.json(items.map(t => ({ code: t.code, title: t.title, status: t.status, priority: t.priority, category: t.category, source: t.source, sentiment: t.sentiment?.label, assignee: t.assignee?.name || null, requester: t.requester?.name || null,
    createdAt: t.createdAt, resolvedAt: t.resolvedAt || null, resolutionHours: t.resolvedAt ? +((t.resolvedAt - t.createdAt) / 36e5).toFixed(2) : null, slaDueAt: t.sla?.dueAt || null, slaBreached: !!t.sla?.breached, rating: t.feedback?.rating ?? null, minutesLogged: (t.timeLogs || []).reduce((s, l) => s + l.minutes, 0), reopenCount: t.reopenCount })));
});
router.use('/v1', v1);
module.exports = router;
