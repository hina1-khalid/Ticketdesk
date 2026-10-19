const { User, Ticket } = require('../models');
// Least-loaded agent (prefers agents of the ticket's department).
exports.autoAssign = async ticket => {
  let agents = await User.find({ org: ticket.org, role: 'agent', active: true }).select('_id departments');
  if (ticket.department) {
    const inDept = agents.filter(a => a.departments.some(d => String(d) === String(ticket.department)));
    if (inDept.length) agents = inDept;
  }
  if (!agents.length) return null;
  const loads = await Ticket.aggregate([{ $match: { org: ticket.org, assignee: { $in: agents.map(a => a._id) }, status: { $in: ['open', 'in_progress'] }, deleted: false } }, { $group: { _id: '$assignee', n: { $sum: 1 } } }]);
  const m = Object.fromEntries(loads.map(l => [String(l._id), l.n]));
  return agents.sort((a, b) => (m[a._id] || 0) - (m[b._id] || 0))[0]._id;
};
