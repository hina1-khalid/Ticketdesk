const PERMS = ['ticket:create', 'ticket:view_all', 'ticket:update', 'ticket:assign', 'ticket:delete', 'ticket:internal', 'canned:use', 'report:view', 'kb:manage', 'user:manage', 'automation:manage', 'apikey:manage', 'audit:view', 'settings:manage'];
const ROLES = ['admin', 'manager', 'viewer', 'agent', 'user'];
const DEFAULTS = {
  admin: PERMS,
  manager: ['ticket:view_all', 'report:view', 'audit:view'],
  viewer: ['report:view'],
  agent: ['ticket:create', 'ticket:view_all', 'ticket:update', 'ticket:assign', 'ticket:internal', 'canned:use', 'report:view'],
  user: ['ticket:create']
};
const can = (stored, role, perm) => role === 'admin' || ((stored && stored[role]) || DEFAULTS[role] || []).includes(perm);
const effective = stored => Object.fromEntries(ROLES.map(r => [r, r === 'admin' ? PERMS : (stored && stored[r]) || DEFAULTS[r]]));
module.exports = { PERMS, ROLES, DEFAULTS, can, effective };
