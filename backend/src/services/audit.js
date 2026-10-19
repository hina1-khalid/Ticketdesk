const { AuditLog } = require('../models');
exports.audit = (req, action, entity, entityId, meta) =>
  AuditLog.create({ org: req.user.org, user: req.user._id, action, entity, entityId: String(entityId || ''), meta }).catch(() => {});
