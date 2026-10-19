// Shared logic for tickets coming from email (webhook or IMAP) and WhatsApp.
const crypto = require('crypto');
const { User, Ticket } = require('../models');
const S = require('./ticketService');

const stripQuoted = text => {
  const out = [];
  for (const l of String(text || '').split(/\r?\n/)) { if (/^>/.test(l) || /^On .+ wrote:\s*$/i.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l)) break; out.push(l); }
  return out.join('\n').trim();
};
const rand = () => crypto.randomBytes(12).toString('hex');

exports.ingestEmail = async ({ org, from, name, subject, text }) => {
  const email = from.toLowerCase();
  let user = await User.findOne({ email });
  if (user && String(user.org) !== String(org._id)) throw new Error('Sender belongs to another organization');
  if (!user) user = await User.create({ org: org._id, name: (name || email.split('@')[0]).slice(0, 80), email, password: rand() });
  const body = stripQuoted(text);
  const ref = String(subject || '').match(/TKT-\d+/i); // reply to an existing ticket thread
  if (ref) {
    const t = await Ticket.findOne({ org: org._id, code: ref[0].toUpperCase(), deleted: false });
    if (t && String(t.requester) === String(user._id)) {
      await S.addComment(t, user, { body: (body || '(empty reply)').slice(0, 5000) });
      if (S.DONE.includes(t.status)) await S.setStatus(t, 'open', user);
      return { code: t.code, reply: true };
    }
  }
  const t = await S.createTicket({ org: org._id, requester: user._id, source: 'email', data: { title: String(subject || '').replace(/^((re|fwd?):\s*)+/i, '').trim().slice(0, 200) || '(no subject)', description: body.slice(0, 10000) || '(empty email)' } });
  return { code: t.code, reply: false };
};

// Commands: "status TKT-0001" | "TKT-0001 more details..." | anything else = new ticket
exports.ingestWhatsApp = async ({ org, phone, name, body }) => {
  let user = await User.findOne({ org: org._id, phone });
  if (!user) user = await User.create({ org: org._id, name: (name || phone).slice(0, 80), email: `wa${phone.replace(/\D/g, '')}@whatsapp.local`, phone, whatsappOptIn: true, password: rand() });
  const st = body.match(/^status\s+(TKT-\d+)/i);
  if (st) {
    const t = await Ticket.findOne({ org: org._id, code: st[1].toUpperCase(), requester: user._id, deleted: false });
    return { text: t ? `${t.code}: ${t.title}\nStatus: ${t.status.replace('_', ' ')}` : 'Ticket not found for your number.' };
  }
  const rep = body.match(/^(TKT-\d+)\s+([\s\S]+)/i);
  if (rep) {
    const t = await Ticket.findOne({ org: org._id, code: rep[1].toUpperCase(), requester: user._id, deleted: false });
    if (!t) return { text: 'Ticket not found for your number.' };
    await S.addComment(t, user, { body: rep[2].slice(0, 5000) });
    return { text: `Message added to ${t.code}.` };
  }
  if (!body.trim()) return { text: 'Send your problem as a message and I will create a ticket.' };
  const t = await S.createTicket({ org: org._id, requester: user._id, source: 'whatsapp', data: { title: body.split('\n')[0].slice(0, 80), description: body.slice(0, 10000) } });
  return { text: `Ticket ${t.code} created. Send "status ${t.code}" anytime to check it.`, code: t.code };
};
