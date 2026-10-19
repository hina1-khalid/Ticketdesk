const mongoose = require('mongoose');
exports.str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
exports.pick = (o, keys) => keys.reduce((a, k) => (o && o[k] !== undefined ? ((a[k] = o[k]), a) : a), {});
exports.csvCell = v => {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
exports.slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'org';
exports.isId = v => typeof v === 'string' && mongoose.isValidObjectId(v);
exports.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
