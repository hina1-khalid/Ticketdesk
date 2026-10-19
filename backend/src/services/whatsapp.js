// WhatsApp through Twilio's REST API (no SDK needed).
const crypto = require('crypto');
const env = require('../config/env');
const queue = require('./queue');
const logger = require('../config/logger');

// 0300-1234567 / 923001234567 / +923001234567 -> +923001234567 ; returns '' when invalid
exports.normPhone = s => {
  let p = String(s || '').replace(/[\s\-()]/g, '');
  if (/^03\d{9}$/.test(p)) p = '+92' + p.slice(1); else if (/^92\d{10}$/.test(p)) p = '+' + p;
  return /^\+\d{8,15}$/.test(p) ? p : '';
};
exports.enabled = () => !!(env.twilio.sid && env.twilio.token && env.twilio.from);
queue.register('whatsapp', async ({ to, body }) => {
  if (!exports.enabled()) return logger.info(`[whatsapp disabled] to=${to} body=${body}`);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilio.sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${env.twilio.sid}:${env.twilio.token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: 'whatsapp:' + env.twilio.from, To: 'whatsapp:' + to, Body: body })
  });
  if (!r.ok) throw new Error('Twilio ' + r.status + ' ' + (await r.text()).slice(0, 200));
});
exports.sendWhatsApp = (to, body) => queue.add('whatsapp', { to, body });
// Twilio request signature: HMAC-SHA1(url + sorted key/value pairs), base64
exports.validSignature = (url, params, signature, token) => {
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', token).update(data).digest('base64');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};
