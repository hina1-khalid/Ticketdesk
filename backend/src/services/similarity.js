const { Ticket } = require('../models');
const STOP = new Set('the and for you your with this that have has not are was were can please help need from our but its into out any all get got hai hain ka ki ke ko se mein nahi mera meri hum aap kya kar raha rahi hota'.split(' '));
const tokens = t => [...new Set((t || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)))];
function jaccard(a, b) { const B = new Set(b); let i = 0; a.forEach(x => B.has(x) && i++); const u = a.length + b.length - i; return u ? i / u : 0; }
async function findSimilar(org, text, { statuses, exclude, limit = 5, min = 0.2, requester } = {}) {
  const q = { org, deleted: false, createdAt: { $gte: new Date(Date.now() - 180 * 864e5) } };
  if (statuses) q.status = { $in: statuses };
  if (exclude) q._id = { $ne: exclude };
  if (requester) q.requester = requester;
  const base = tokens(text);
  if (!base.length) return [];
  const list = await Ticket.find(q).sort('-createdAt').limit(400).select('code title description status').lean();
  return list.map(t => ({ _id: t._id, code: t.code, title: t.title, status: t.status, score: +jaccard(base, tokens(t.title + ' ' + t.description)).toFixed(2) }))
    .filter(t => t.score >= min).sort((a, b) => b.score - a.score).slice(0, limit);
}
module.exports = { STOP, tokens, jaccard, findSimilar };
