const { Notification, User } = require('../models');
const rt = require('./realtime');
const { sendMail } = require('./mailer');
const env = require('../config/env');
const { esc } = require('../utils');
const { sendWhatsApp, enabled: waEnabled } = require('./whatsapp');
const WA_TYPES = ['status', 'assigned', 'sla', 'created'];

// In-app (bell + socket) and optional email notification.
exports.notify = async (userIds, { org, type, message, ticket }, { email = true } = {}) => {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  for (const id of ids) {
    const n = await Notification.create({ org, user: id, type, message, ticket: ticket?._id });
    rt.emitUser(id, 'notification', n);
  }
  if (WA_TYPES.includes(type) && waEnabled()) {
    const wa = await User.find({ _id: { $in: ids }, active: true, whatsappOptIn: true, phone: { $exists: true, $ne: '' } }).select('phone');
    wa.forEach(u => sendWhatsApp(u.phone, message.slice(0, 300)));
  }
  if (email) {
    const users = await User.find({ _id: { $in: ids }, active: true }).select('email');
    const link = ticket ? `<p><a href="${env.clientUrl}/tickets/${ticket._id}">Open ticket ${esc(ticket.code)}</a></p>` : '';
    users.forEach(u => sendMail(u.email, message.slice(0, 120), `<p>${esc(message)}</p>${link}`));
  }
};
exports.adminIds = async org => (await User.find({ org, role: 'admin', active: true }).select('_id')).map(u => u._id);
