const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, ApiKey } = require('../models');
const env = require('../config/env');
const { getSettings } = require('../services/settings');
const { can: roleCan } = require('../permissions');

exports.auth = async (req, res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ message: 'Login required' });
  let id;
  try { id = jwt.verify(h.slice(7), env.jwtSecret).id; } catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
  const user = await User.findById(id);
  if (!user || !user.active) return res.status(401).json({ message: 'Account not available' });
  req.user = user;
  req.settings = await getSettings(user.org);
  req.can = p => roleCan(req.settings.permissions, user.role, p);
  next();
};
exports.can = perm => (req, res, next) => (req.can(perm) ? next() : res.status(403).json({ message: 'You do not have permission for this action' }));
exports.signToken = u => jwt.sign({ id: u._id }, env.jwtSecret, { expiresIn: '7d' });
exports.apiKeyAuth = async (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ message: 'x-api-key header required' });
  const rec = await ApiKey.findOneAndUpdate({ hash: crypto.createHash('sha256').update(key).digest('hex') }, { lastUsed: new Date() });
  if (!rec) return res.status(401).json({ message: 'Invalid API key' });
  req.apiOrg = rec.org;
  next();
};
