const router = require('express').Router();
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { User, Organization, Settings } = require('../models');
const { auth, signToken } = require('../middleware/auth');
const { str, slugify } = require('../utils');
const { PERMS } = require('../permissions');
const crypto = require('crypto');
const { normPhone } = require('../services/whatsapp');

const view = u => ({ id: u._id, name: u.name, email: u.email, role: u.role, isSenior: u.isSenior, language: u.language, phone: u.phone || '', whatsappOptIn: !!u.whatsappOptIn, org: u.org, twoFactor: !!u.twoFactor?.enabled });

router.post('/register', async (req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 120).toLowerCase(), password = str(req.body.password, 100);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Valid name and email are required' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
  if (await User.exists({ email })) return res.status(409).json({ message: 'This email is already registered' });
  let org, role = 'user';
  const orgSlug = str(req.body.orgSlug, 40).toLowerCase();
  if (orgSlug) {
    org = await Organization.findOne({ slug: orgSlug });
    if (!org) return res.status(404).json({ message: 'Organization code not found' });
  } else {
    const orgName = str(req.body.orgName, 80) || `${name}'s organization`;
    org = await Organization.create({ name: orgName, slug: slugify(orgName) + '-' + crypto.randomBytes(2).toString('hex') });
    await Settings.create({ org: org._id });
    role = 'admin';
  }
  const user = await User.create({ org: org._id, name, email, password, role });
  res.status(201).json({ token: signToken(user), user: view(user) });
});

router.post('/login', async (req, res) => {
  const email = str(req.body.email).toLowerCase(), password = str(req.body.password, 100), otp = str(req.body.otp, 10);
  const u = await User.findOne({ email }).select('+password +twoFactor.secret');
  if (!u || !u.active || !(await u.matches(password))) return res.status(401).json({ message: 'Wrong email or password' });
  if (u.twoFactor?.enabled) {
    if (!otp) return res.json({ twoFactorRequired: true });
    if (!authenticator.check(otp, u.twoFactor.secret)) return res.status(401).json({ message: 'Invalid authentication code' });
  }
  res.json({ token: signToken(u), user: view(u) });
});

router.get('/me', auth, (req, res) => res.json({ user: view(req.user), permissions: PERMS.filter(p => req.can(p)) }));

router.put('/me', auth, async (req, res) => {
  if (req.body.name) req.user.name = str(req.body.name, 80);
  if (['en', 'ur'].includes(req.body.language)) req.user.language = req.body.language;
  if ('phone' in req.body) {
    const raw = str(req.body.phone, 20), p = normPhone(raw);
    if (raw && !p) return res.status(400).json({ message: 'Invalid phone. Use e.g. 03001234567 or +923001234567' });
    req.user.phone = p || undefined;
  }
  if (typeof req.body.whatsappOptIn === 'boolean') req.user.whatsappOptIn = req.body.whatsappOptIn;
  if (req.body.newPassword) {
    const u = await User.findById(req.user._id).select('+password');
    if (!(await u.matches(str(req.body.currentPassword, 100)))) return res.status(400).json({ message: 'Current password is wrong' });
    if (str(req.body.newPassword, 100).length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
    req.user.password = str(req.body.newPassword, 100);
  }
  await req.user.save();
  res.json(view(req.user));
});

router.post('/2fa/setup', auth, async (req, res) => {
  const secret = authenticator.generateSecret();
  await User.updateOne({ _id: req.user._id }, { 'twoFactor.secret': secret, 'twoFactor.enabled': false });
  const uri = authenticator.keyuri(req.user.email, 'TicketDesk', secret);
  res.json({ secret, qr: await QRCode.toDataURL(uri) });
});
router.post('/2fa/enable', auth, async (req, res) => {
  const u = await User.findById(req.user._id).select('+twoFactor.secret');
  if (!u.twoFactor.secret || !authenticator.check(str(req.body.token, 10), u.twoFactor.secret)) return res.status(400).json({ message: 'Invalid code' });
  u.twoFactor.enabled = true; await u.save();
  res.json({ enabled: true });
});
router.post('/2fa/disable', auth, async (req, res) => {
  const u = await User.findById(req.user._id).select('+twoFactor.secret');
  if (!u.twoFactor.enabled || !authenticator.check(str(req.body.token, 10), u.twoFactor.secret)) return res.status(400).json({ message: 'Invalid code' });
  u.twoFactor.enabled = false; u.twoFactor.secret = undefined; await u.save();
  res.json({ enabled: false });
});
module.exports = router;
