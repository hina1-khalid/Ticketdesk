const { Ticket, Counter, Department, User } = require('../models');
const { getSettings } = require('./settings');
const { computeDue } = require('./sla');
const { classify } = require('./classifier');
const { autoAssign } = require('./assignment');
const { runAutomation } = require('./automation');
const { notify } = require('./notify');
const { emitEvent } = require('./events');
const rt = require('./realtime');
const cache = require('./cache');

const WEIGHT = { low: 1, medium: 2, high: 3, urgent: 4 };
const OPEN = ['open', 'in_progress'], DONE = ['resolved', 'closed'];
const weightFor = (p, s) => WEIGHT[p] + (s?.label === 'negative' ? 0.5 : 0); // angry tickets float up
const log = (t, by, field, from, to) => t.history.push({ by, action: 'changed', field, from: String(from ?? ''), to: String(to ?? '') });

async function afterChange(t, event) {
  await cache.delPrefix('stats:' + t.org);
  rt.emitOrg(t.org, 'ticket:changed', { id: t._id });
  if (event) emitEvent(t.org, event, { id: t._id, code: t.code, title: t.title, status: t.status, priority: t.priority });
}

async function createTicket({ org, requester, data, source = 'web', files = [], silent = false }) {
  const settings = await getSettings(org);
  const ai = await classify(`${data.title} ${data.description}`);
  const category = data.category || ai.category, priority = data.priority || ai.priority;
  const c = await Counter.findOneAndUpdate({ _id: String(org) }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  const dept = await Department.findOne({ org, categories: category });
  const t = new Ticket({
    org, number: c.seq, code: 'TKT-' + String(c.seq).padStart(4, '0'), title: data.title, description: data.description,
    category, priority, priorityWeight: weightFor(priority, ai.sentiment), tags: [...new Set([...(data.tags || []), ...ai.tags])].slice(0, 8),
    department: dept?._id, requester, attachments: files, customFields: data.customFields || {}, sentiment: ai.sentiment, source
  });
  t.sla.dueAt = computeDue(settings, priority, data.createdAt || new Date());
  if (data.createdAt) t.createdAt = data.createdAt;
  t.history.push({ by: requester, action: 'created' });
  if (!silent) {
    const agent = await autoAssign(t);
    if (agent) { t.assignee = agent; t.history.push({ action: 'auto_assigned', to: String(agent) }); }
    await runAutomation('ticket.created', t);
  }
  await t.save();
  if (!silent) {
    await afterChange(t, 'ticket.created');
    await notify([t.assignee], { org, type: 'assigned', message: `New ticket ${t.code} assigned to you: ${t.title}`, ticket: t });
    await notify([requester], { org, type: 'created', message: `Your ticket ${t.code} was created: ${t.title}`, ticket: t });
  }
  return t;
}

async function setStatus(t, status, by) {
  const from = t.status;
  if (from === status) return t;
  const settings = await getSettings(t.org);
  t.status = status; log(t, by?._id, 'status', from, status);
  if (status === 'resolved') t.resolvedAt = new Date();
  if (status === 'closed') { t.closedAt = new Date(); t.resolvedAt = t.resolvedAt || new Date(); }
  if (OPEN.includes(status) && DONE.includes(from)) {
    t.resolvedAt = undefined; t.closedAt = undefined; t.reopenCount += 1;
    t.sla.breached = false; t.sla.escalated = false; t.sla.dueAt = computeDue(settings, t.priority);
  }
  t.lastActivityAt = new Date();
  await runAutomation('ticket.status_changed', t);
  await t.save();
  if (!by || String(by._id) !== String(t.requester)) await notify([t.requester], { org: t.org, type: 'status', message: `Ticket ${t.code} is now ${t.status.replace('_', ' ')}`, ticket: t });
  await afterChange(t, 'ticket.status_changed');
  return t;
}

async function assign(t, assigneeId, by) {
  let id = assigneeId;
  if (!id) id = await autoAssign(t);
  const from = t.assignee;
  t.assignee = id || undefined; log(t, by?._id, 'assignee', from, id);
  if (id && t.status === 'open') { t.status = 'in_progress'; log(t, by?._id, 'status', 'open', 'in_progress'); }
  t.lastActivityAt = new Date();
  await t.save();
  if (id && (!by || String(id) !== String(by._id))) await notify([id], { org: t.org, type: 'assigned', message: `Ticket ${t.code} was assigned to you: ${t.title}`, ticket: t });
  await afterChange(t, 'ticket.assigned');
  return t;
}

async function addComment(t, author, { body, internal = false, mentions = [] }) {
  const isRequester = String(author._id) === String(t.requester);
  t.comments.push({ author: author._id, body, internal, mentions });
  t.lastActivityAt = new Date();
  if (!internal && !isRequester && !t.sla.firstResponseAt) t.sla.firstResponseAt = new Date();
  await t.save();
  const msg = `${author.name} commented on ${t.code}: ${body.slice(0, 80)}`;
  if (!internal && !isRequester) await notify([t.requester], { org: t.org, type: 'comment', message: msg, ticket: t });
  if (isRequester) await notify([t.assignee], { org: t.org, type: 'comment', message: msg, ticket: t });
  const ment = mentions.filter(m => String(m) !== String(author._id));
  if (ment.length) await notify(ment, { org: t.org, type: 'mention', message: `${author.name} mentioned you on ${t.code}`, ticket: t });
  rt.emitOrg(t.org, 'ticket:changed', { id: t._id });
  await cache.delPrefix('stats:' + t.org);
  return t;
}

module.exports = { createTicket, setStatus, assign, addComment, afterChange, log, weightFor, WEIGHT, OPEN, DONE };
