const { AutomationRule, Department, User } = require('../models');
const { notify, adminIds } = require('./notify');
const WEIGHT = { low: 1, medium: 2, high: 3, urgent: 4 };

function fieldValue(t, f) {
  if (f === 'tag') return t.tags;
  if (f === 'sentiment') return t.sentiment?.label;
  if (f === 'department') return t.departmentName || '';
  return t[f];
}
function test(t, c) {
  const v = fieldValue(t, c.field), want = (c.value || '').toLowerCase();
  const arr = Array.isArray(v) ? v.map(x => String(x).toLowerCase()) : [String(v ?? '').toLowerCase()];
  switch (c.op) {
    case 'neq': return !arr.includes(want);
    case 'contains': return arr.some(x => x.includes(want));
    case 'in': return arr.some(x => want.split(',').map(s => s.trim()).includes(x));
    default: return arr.includes(want);
  }
}
async function apply(t, a, rule) {
  const v = a.value || '';
  switch (a.type) {
    case 'assign_department': { const d = await Department.findOne({ org: t.org, name: new RegExp('^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }); if (d) { t.department = d._id; } break; }
    case 'assign_agent': { const u = await User.findOne({ org: t.org, email: v.toLowerCase() }); if (u) t.assignee = u._id; break; }
    case 'set_priority': if (WEIGHT[v]) { t.priority = v; t.priorityWeight = WEIGHT[v]; } break;
    case 'add_tag': if (v && !t.tags.includes(v)) t.tags.push(v); break;
    case 'set_status': if (['open', 'in_progress', 'resolved', 'closed'].includes(v)) t.status = v; break;
    case 'notify': case 'remind': {
      let ids = [];
      if (v === 'requester') ids = [t.requester]; else if (v === 'assignee' || a.type === 'remind') ids = [t.assignee || t.requester];
      else if (v === 'admins' || !v) ids = await adminIds(t.org);
      else { const u = await User.findOne({ org: t.org, email: v.toLowerCase() }); if (u) ids = [u._id]; }
      await notify(ids, { org: t.org, type: 'automation', message: `Automation "${rule.name}" on ${t.code}: ${t.title}`, ticket: t });
      if (a.type === 'remind') t.reminderSentAt = new Date();
      break;
    }
  }
}
// Mutates the ticket (caller saves). Returns true if any rule fired.
exports.runAutomation = async (trigger, t) => {
  const rules = await AutomationRule.find({ org: t.org, active: true, trigger });
  if (!rules.length) return false;
  if (t.department) { const d = await Department.findById(t.department).select('name'); t.departmentName = d?.name; }
  let fired = false;
  for (const r of rules) {
    if (!r.conditions.every(c => test(t, c))) continue;
    for (const a of r.actions) await apply(t, a, r);
    t.history.push({ action: 'automation', field: r.name });
    fired = true;
  }
  return fired;
};
