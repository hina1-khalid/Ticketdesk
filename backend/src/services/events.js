const crypto = require('crypto');
const { Webhook } = require('../models');
const queue = require('./queue');
const env = require('../config/env');
queue.register('webhook', async ({ url, secret, body }) => {
  const sig = secret ? crypto.createHmac('sha256', secret).update(body).digest('hex') : '';
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-TicketDesk-Signature': sig }, body });
});
queue.register('slack', async ({ text }) => {
  await fetch(env.slack, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
});
const SLACK_EVENTS = ['ticket.created', 'ticket.sla_breached', 'anomaly.detected'];
exports.emitEvent = async (org, event, payload) => {
  try {
    const hooks = await Webhook.find({ org, active: true, events: event });
    const body = JSON.stringify({ event, at: new Date().toISOString(), data: payload });
    hooks.forEach(h => queue.add('webhook', { url: h.url, secret: h.secret, body }));
    if (env.slack && SLACK_EVENTS.includes(event)) queue.add('slack', { text: `*${event}* ${payload.code || ''} ${payload.title || payload.message || ''}` });
  } catch { /* never break the request because of integrations */ }
};
