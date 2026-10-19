// Usage: npm run seed   (WARNING: drops the database)
const mongoose = require('mongoose');
const env = require('./config/env');
const M = require('./models');
const { createTicket } = require('./services/ticketService');
const { computeDue } = require('./services/sla');
const rnd = a => a[Math.floor(Math.random() * a.length)];

(async () => {
  await mongoose.connect(env.mongo); for (const c of await mongoose.connection.db.collections()) await c.deleteMany({});
  const org = await M.Organization.create({ name: 'Demo Company', slug: 'demo' });
  const settings = (await M.Settings.create({ org: org._id })).toObject();
  const [it, hr, fin] = await M.Department.create([{ org: org._id, name: 'IT', categories: ['IT', 'Account', 'Bug'] }, { org: org._id, name: 'HR', categories: ['HR'] }, { org: org._id, name: 'Finance', categories: ['Billing'] }]);
  const pw = 'Password123!';
  const mk = (name, email, role, extra = {}) => M.User.create({ org: org._id, name, email, role, password: pw, ...extra });
  const admin = await mk('Admin', 'admin@demo.com', 'admin');
  await mk('Manager Mina', 'manager@demo.com', 'manager'); await mk('Viewer Vik', 'viewer@demo.com', 'viewer');
  const a1 = await mk('Agent Ali', 'agent@demo.com', 'agent', { departments: [it._id] });
  const a2 = await mk('Senior Sana', 'senior@demo.com', 'agent', { isSenior: true, departments: [it._id, hr._id] });
  const a3 = await mk('Agent Bilal', 'bilal@demo.com', 'agent', { departments: [fin._id] });
  const users = [await mk('Ayesha Khan', 'user@demo.com', 'user'), await mk('Hamza Raza', 'hamza@demo.com', 'user'), await mk('Zara Ahmed', 'zara@demo.com', 'user')];

  await M.KBArticle.create([
    { org: org._id, title: 'How to reset your password', category: 'Account', tags: ['password', 'login'], body: '1. Open the login page.\n2. Click "Forgot password".\n3. Enter your email and follow the link.\nIf the email does not arrive, check spam or create a ticket.' },
    { org: org._id, title: 'WiFi / internet not connecting', category: 'IT', tags: ['wifi', 'internet', 'network'], body: 'Restart your router, forget and re-join the network, then check whether other devices are affected. If the issue continues, send us your device name.' },
    { org: org._id, title: 'Requesting a refund or invoice copy', category: 'Billing', tags: ['refund', 'invoice', 'payment'], body: 'Refunds are processed in 5-7 working days. Include your invoice number when you create the ticket.' },
    { org: org._id, title: 'Leave and attendance policy', category: 'HR', tags: ['leave', 'attendance'], body: 'Apply for leave via HR at least 2 days in advance. Emergency leave must be reported the same day.' },
    { org: org._id, title: 'Login nahi ho raha? (Roman Urdu guide)', category: 'Account', tags: ['login', 'password', 'urdu'], body: 'Pehle password reset try karein. Phir browser cache clear karein. Masla rahe to ticket bana dein.' }]);
  await M.CannedResponse.create([
    { org: org._id, title: 'Greeting', body: 'Hello! Thanks for contacting support. We are looking into this right now.' },
    { org: org._id, title: 'Need more info', body: 'Could you please share a screenshot and the exact time the problem happened?', category: 'Bug' },
    { org: org._id, title: 'Resolved', body: 'We have fixed the issue. Please confirm everything works on your side, and rate your experience.' },
    { org: org._id, title: 'Password reset (Roman Urdu)', body: 'Aap ka password reset kar diya gaya hai. Naya password email par bhej diya hai.', category: 'Account' }]);
  await M.AutomationRule.create([
    { org: org._id, name: 'Billing -> Finance', trigger: 'ticket.created', conditions: [{ field: 'category', op: 'eq', value: 'Billing' }], actions: [{ type: 'assign_department', value: 'Finance' }, { type: 'add_tag', value: 'finance' }] },
    { org: org._id, name: 'Urgent -> notify admins', trigger: 'ticket.created', conditions: [{ field: 'priority', op: 'eq', value: 'urgent' }], actions: [{ type: 'notify', value: 'admins' }] },
    { org: org._id, name: '24h no activity reminder', trigger: 'ticket.idle', idleHours: 24, conditions: [], actions: [{ type: 'remind', value: 'assignee' }] }]);

  const subjects = [['Cannot login to my account', 'Password reset email is not coming. I am unable to sign in.'], ['mera login nahi ho raha', 'password bhool gaya hoon aur account khul nahi raha'], ['Printer not working on floor 2', 'The printer shows an error and nothing prints.'], ['Refund for double charged invoice', 'I was charged twice for invoice 4421. Need refund ASAP!!'], ['WiFi very slow', 'Internet is slow in the meeting room since morning.'], ['Salary slip missing', 'My salary slip for last month is not in the portal. tankhwah slip chahiye.'], ['App crashes on upload', 'Bug: the app crashes with an error when I upload a PDF.'], ['Feature request: dark mode', 'It would be nice to have a dark mode in the dashboard.'], ['Server down in production', 'URGENT: production server is down, customers cannot order. Critical!'], ['Leave balance wrong', 'My leave balance shows 2 days but should be 8 (chutti ka balance ghalat hai).'], ['VPN disconnects', 'VPN keeps disconnecting every 10 minutes, very frustrating and unacceptable.'], ['Payment nahi ho rahi', 'Card se payment nahi ho rahi, error aa raha hai.']];
  const agents = [a1, a2, a3, admin];
  for (let i = 0; i < 60; i++) {
    const [title, description] = rnd(subjects), created = new Date(Date.now() - Math.random() * 55 * 864e5);
    const t = await createTicket({ org: org._id, requester: rnd(users)._id, source: rnd(['web', 'web', 'email', 'api']), silent: true, data: { title, description, createdAt: created } });
    t.assignee = rnd(agents)._id;
    const r = Math.random();
    if (r < 0.65) { t.status = rnd(['resolved', 'closed']); t.resolvedAt = new Date(created.getTime() + (1 + Math.random() * 40) * 36e5); if (t.status === 'closed') t.closedAt = t.resolvedAt; if (Math.random() < 0.7) t.feedback = { rating: rnd([5, 5, 4, 4, 3, 2, 1]), at: t.resolvedAt }; }
    else if (r < 0.8) t.status = 'in_progress';
    t.sla.breached = ['open', 'in_progress'].includes(t.status) && t.sla.dueAt < new Date();
    t.timeLogs.push({ user: t.assignee, minutes: 10 + Math.floor(Math.random() * 90), note: 'work' });
    t.comments.push({ author: t.assignee, body: 'Looking into it, will update you shortly.', internal: false });
    t.lastActivityAt = t.resolvedAt || created; await t.save();
  }
  console.log('Seeded. Org code: demo | password for all: ' + pw + '\nadmin@demo.com  agent@demo.com  senior@demo.com  manager@demo.com  viewer@demo.com  user@demo.com');
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
