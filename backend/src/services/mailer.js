const nodemailer = require('nodemailer');
const env = require('../config/env');
const queue = require('./queue');
const logger = require('../config/logger');
const s = env.smtp;
const transport = s.host ? nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, auth: s.user ? { user: s.user, pass: s.pass } : undefined }) : null;
queue.register('email', async ({ to, subject, html }) => {
  if (!transport) return logger.info(`[mail disabled] to=${to} subject=${subject}`);
  await transport.sendMail({ from: s.from, to, subject, html });
});
exports.sendMail = (to, subject, html) => queue.add('email', { to, subject, html });
