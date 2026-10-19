// Polls a support mailbox and turns unread mails into tickets (or replies to existing tickets).
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const env = require('../config/env');
const logger = require('../config/logger');
const { Organization } = require('../models');
const { ingestEmail } = require('./inbound');
let running = false;

exports.enabled = () => !!(env.imap.host && env.imap.user && env.imap.pass);
exports.poll = async () => {
  if (!exports.enabled() || running) return;
  running = true;
  const client = new ImapFlow({ host: env.imap.host, port: env.imap.port, secure: env.imap.port === 993, auth: { user: env.imap.user, pass: env.imap.pass }, logger: false });
  try {
    const org = await Organization.findOne({ slug: env.imap.orgSlug });
    if (!org) throw new Error(`IMAP_ORG_SLUG "${env.imap.orgSlug}" not found`);
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = (await client.search({ seen: false }, { uid: true })).slice(0, 20);
      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(uid, { source: true }, { uid: true });
          const mail = await simpleParser(msg.source);
          const from = mail.from?.value?.[0];
          const auto = /auto-(generated|replied)|bulk|list/i.test(`${mail.headers.get('auto-submitted') || ''} ${mail.headers.get('precedence') || ''}`);
          if (from?.address && from.address.toLowerCase() !== env.imap.user.toLowerCase() && !auto) {
            const r = await ingestEmail({ org, from: from.address, name: from.name, subject: mail.subject, text: mail.text });
            logger.info(`IMAP: ${r.reply ? 'reply added to' : 'created'} ${r.code}`);
          }
        } catch (e) { logger.error('IMAP message: ' + e.message); }
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }
    } finally { lock.release(); }
  } catch (e) { logger.error('IMAP poll: ' + e.message); }
  finally { try { await client.logout(); } catch { /* ignore */ } running = false; }
};
