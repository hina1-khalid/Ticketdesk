const router = require('express').Router();
const { KBArticle, Notification, Ticket } = require('../models');
const { auth } = require('../middleware/auth');
const { str, isId } = require('../utils');
router.use(auth);

// ---- Knowledge base (read) ----
router.get('/kb', async (req, res) => {
  const q = str(req.query.q, 200), f = { org: req.user.org, published: true };
  if (str(req.query.category)) f.category = str(req.query.category);
  if (q) { f.$text = { $search: q }; return res.json(await KBArticle.find(f, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(30).select('-body')); }
  res.json(await KBArticle.find(f).sort('-views').limit(50).select('-body'));
});
router.get('/kb/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ message: 'Bad id' });
  const a = await KBArticle.findOneAndUpdate({ _id: req.params.id, org: req.user.org, published: true }, { $inc: { views: 1 } }, { new: true });
  a ? res.json(a) : res.status(404).json({ message: 'Article not found' });
});
router.post('/kb/:id/helpful', async (req, res) => { await KBArticle.updateOne({ _id: req.params.id, org: req.user.org }, { $inc: { helpful: 1 } }); res.json({ ok: true }); });

// ---- Chatbot: answers from KB, offers to open a ticket otherwise ----
router.post('/chatbot', async (req, res) => {
  const msg = str(req.body.message, 300), ur = req.user.language === 'ur';
  if (!msg) return res.status(400).json({ message: 'Say something' });
  if (/^(hi|hello|salam|assalam|hey)\b/i.test(msg)) return res.json({ reply: ur ? 'السلام علیکم! آپ کو کیا مسئلہ ہے؟' : 'Hello! Tell me what problem you are facing and I will look for an answer.', articles: [] });
  const articles = await KBArticle.find({ org: req.user.org, published: true, $text: { $search: msg } }, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } }).limit(3).select('title category');
  if (articles.length) return res.json({ reply: ur ? 'یہ مضامین مددگار ہو سکتے ہیں۔ اگر مسئلہ حل نہ ہو تو ٹکٹ بنا لیں۔' : 'These articles may help. If it does not solve your problem, I can open a ticket.', articles, createTicket: true, title: msg });
  res.json({ reply: ur ? 'مجھے کوئی جواب نہیں ملا۔ کیا میں آپ کے لیے ٹکٹ بنا دوں؟' : 'I could not find an answer in the knowledge base. Want me to open a ticket?', articles: [], createTicket: true, title: msg });
});

// ---- Notifications ----
router.get('/notifications', async (req, res) => {
  const [items, unread] = await Promise.all([Notification.find({ user: req.user._id }).sort('-createdAt').limit(30).populate('ticket', 'code'), Notification.countDocuments({ user: req.user._id, read: false })]);
  res.json({ items, unread });
});
router.post('/notifications/read-all', async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); });
router.post('/notifications/:id/read', async (req, res) => { await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true }); res.json({ ok: true }); });
module.exports = router;
