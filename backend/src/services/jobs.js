const cron = require('node-cron');
const { Ticket, User, Organization, Department, Settings } = require('../models');
const { notify, adminIds } = require('./notify');
const { emitEvent } = require('./events');
const { runAutomation } = require('./automation');
const { hourlyAnomaly } = require('./stats');
const { sendMail } = require('./mailer');
const { afterChange } = require('./ticketService');
const cache = require('./cache');
const logger = require('../config/logger');
const imap = require('./imap');
const { esc } = require('../utils');

// SLA breach -> mark red + escalate to senior agent (same department) or admin
async function slaCheck() {
  const late = await Ticket.find({ deleted: false, status: { $in: ['open', 'in_progress'] }, 'sla.dueAt': { $lt: new Date() }, 'sla.breached': false });
  for (const t of late) {
    t.sla.breached = true;
    let target = await User.findOne({ org: t.org, role: 'agent', isSenior: true, active: true, ...(t.department ? { departments: t.department } : {}) });
    if (!target) target = await User.findOne({ org: t.org, role: 'admin', active: true });
    if (target && String(target._id) !== String(t.assignee)) { t.history.push({ action: 'escalated', from: String(t.assignee || ''), to: String(target._id) }); t.assignee = target._id; t.sla.escalated = true; }
    await t.save();
    await notify([...(target ? [target._id] : []), ...(await adminIds(t.org))], { org: t.org, type: 'sla', message: `SLA breached: ${t.code} ${t.title}`, ticket: t });
    await afterChange(t, 'ticket.sla_breached');
  }
  if (late.length) logger.info(`SLA check: ${late.length} breached`);
}
async function idleCheck() {
  const rules = await require('../models').AutomationRule.find({ active: true, trigger: 'ticket.idle' });
  for (const r of rules) {
    const cutoff = new Date(Date.now() - (r.idleHours || 24) * 36e5);
    const list = await Ticket.find({ org: r.org, deleted: false, status: { $in: ['open', 'in_progress'] }, lastActivityAt: { $lt: cutoff }, $or: [{ reminderSentAt: null }, { reminderSentAt: { $lt: cutoff } }] }).limit(100);
    for (const t of list) { if (await runAutomation('ticket.idle', t)) { t.reminderSentAt = new Date(); await t.save(); } }
  }
}
async function anomalyCheck() {
  for (const o of await Organization.find().select('_id')) {
    if (await cache.get('anomaly:' + o._id)) continue;
    const a = await hourlyAnomaly(o._id);
    if (a.anomaly) {
      await cache.set('anomaly:' + o._id, 1, 3 * 3600);
      const message = `Ticket spike detected: ${a.recentPerHour}/hour vs normal ${a.baselinePerHour}/hour`;
      await notify(await adminIds(o._id), { org: o._id, type: 'anomaly', message });
      emitEvent(o._id, 'anomaly.detected', { message });
    }
  }
}
async function autoArchive() {
  for (const s of await Settings.find()) {
    if (!s.autoArchiveDays) continue;
    await Ticket.updateMany({ org: s.org, status: 'closed', archived: false, closedAt: { $lt: new Date(Date.now() - s.autoArchiveDays * 864e5) } }, { archived: true });
  }
}
async function weeklySummary() {
  const since = new Date(Date.now() - 7 * 864e5);
  for (const o of await Organization.find()) {
    const [created, resolved, open, breached] = await Promise.all([
      Ticket.countDocuments({ org: o._id, createdAt: { $gte: since } }), Ticket.countDocuments({ org: o._id, resolvedAt: { $gte: since } }),
      Ticket.countDocuments({ org: o._id, deleted: false, status: { $in: ['open', 'in_progress'] } }), Ticket.countDocuments({ org: o._id, deleted: false, 'sla.breached': true, createdAt: { $gte: since } })]);
    const to = await User.find({ org: o._id, role: { $in: ['admin', 'manager'] }, active: true }).select('email');
    const html = `<h2>${esc(o.name)} - weekly summary</h2><ul><li>New tickets: ${created}</li><li>Resolved: ${resolved}</li><li>Currently open: ${open}</li><li>SLA breaches: ${breached}</li></ul>`;
    to.forEach(u => sendMail(u.email, 'Weekly support summary', html));
  }
}
const safe = (name, fn) => async () => { try { await fn(); } catch (e) { logger.error(`${name}: ${e.message}`); } };
exports.start = () => {
  cron.schedule('*/5 * * * *', safe('slaCheck', slaCheck));
  cron.schedule('*/15 * * * *', safe('idleCheck', idleCheck));
  cron.schedule('*/15 * * * *', safe('anomalyCheck', anomalyCheck));
  cron.schedule('0 * * * *', safe('autoArchive', autoArchive));
  if (imap.enabled()) { cron.schedule('* * * * *', safe('imap', imap.poll)); logger.info('IMAP inbox polling every minute'); }
  cron.schedule('0 9 * * 1', safe('weeklySummary', weeklySummary));
  logger.info('Cron jobs scheduled');
};
exports.slaCheck = slaCheck; exports.weeklySummary = weeklySummary;
