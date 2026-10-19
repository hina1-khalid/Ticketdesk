const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema, model } = mongoose;
const ObjId = Schema.Types.ObjectId;
const ref = (r, extra = {}) => ({ type: ObjId, ref: r, ...extra });

const Organization = model('Organization', new Schema({ name: String, slug: { type: String, unique: true } }, { timestamps: true }));

const userSchema = new Schema({
  org: ref('Organization', { index: true }),
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'manager', 'viewer', 'agent', 'user'], default: 'user' },
  isSenior: { type: Boolean, default: false },
  departments: [ref('Department')],
  language: { type: String, default: 'en' },
  phone: { type: String, index: true }, whatsappOptIn: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  twoFactor: { enabled: { type: Boolean, default: false }, secret: { type: String, select: false } }
}, { timestamps: true });
userSchema.pre('save', async function (next) { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10); next(); });
userSchema.methods.matches = function (p) { return bcrypt.compare(p, this.password); };
const User = model('User', userSchema);

const Department = model('Department', new Schema({ org: ref('Organization', { index: true }), name: { type: String, required: true }, categories: [String] }, { timestamps: true }));
const Counter = model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));

const commentSchema = new Schema({ author: ref('User'), body: String, internal: { type: Boolean, default: false }, mentions: [ref('User')] }, { timestamps: true });
const historySchema = new Schema({ by: ref('User'), action: String, field: String, from: String, to: String, at: { type: Date, default: Date.now } }, { _id: false });
const ticketSchema = new Schema({
  org: ref('Organization', { index: true }), number: Number, code: { type: String, index: true },
  title: { type: String, required: true }, description: { type: String, required: true },
  category: { type: String, default: 'General' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  priorityWeight: { type: Number, default: 2 },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open', index: true },
  tags: [String], department: ref('Department'), requester: ref('User', { index: true }), assignee: ref('User', { index: true }),
  attachments: [{ name: String, url: String, size: Number, _id: false }],
  customFields: { type: Map, of: String },
  sentiment: { score: { type: Number, default: 0 }, label: { type: String, default: 'neutral' } },
  source: { type: String, default: 'web' },
  sla: { dueAt: Date, breached: { type: Boolean, default: false }, escalated: { type: Boolean, default: false }, firstResponseAt: Date },
  comments: [commentSchema], history: [historySchema],
  links: [ref('Ticket')], mergedInto: ref('Ticket'),
  timeLogs: [{ user: ref('User'), minutes: Number, note: String, at: { type: Date, default: Date.now } }],
  feedback: { rating: Number, comment: String, at: Date },
  resolvedAt: Date, closedAt: Date, reopenCount: { type: Number, default: 0 },
  lastActivityAt: { type: Date, default: Date.now }, reminderSentAt: Date,
  archived: { type: Boolean, default: false }, deleted: { type: Boolean, default: false }, deletedAt: Date
}, { timestamps: true });
ticketSchema.index({ title: 'text', description: 'text', 'comments.body': 'text', tags: 'text' });
ticketSchema.index({ org: 1, createdAt: -1 });
const Ticket = model('Ticket', ticketSchema);

const Settings = model('Settings', new Schema({
  org: { type: ObjId, unique: true },
  categories: { type: [String], default: ['General', 'IT', 'Account', 'Billing', 'HR', 'Bug', 'Feature'] },
  slaHours: { low: { type: Number, default: 72 }, medium: { type: Number, default: 24 }, high: { type: Number, default: 8 }, urgent: { type: Number, default: 2 } },
  businessHours: { enabled: { type: Boolean, default: true }, startHour: { type: Number, default: 9 }, endHour: { type: Number, default: 18 }, days: { type: [Number], default: [1, 2, 3, 4, 5] }, utcOffsetMinutes: { type: Number, default: 300 } },
  holidays: { type: [String], default: [] },
  customFields: [{ category: String, key: String, label: String, _id: false }],
  autoArchiveDays: { type: Number, default: 30 },
  permissions: { type: Schema.Types.Mixed, default: {} }
}, { minimize: false }));

const KBArticle = model('KBArticle', (() => {
  const s = new Schema({ org: ref('Organization', { index: true }), title: { type: String, required: true }, body: { type: String, required: true }, category: String, tags: [String], published: { type: Boolean, default: true }, views: { type: Number, default: 0 }, helpful: { type: Number, default: 0 } }, { timestamps: true });
  s.index({ title: 'text', body: 'text', tags: 'text' });
  return s;
})());
const CannedResponse = model('CannedResponse', new Schema({ org: ref('Organization', { index: true }), title: { type: String, required: true }, body: { type: String, required: true }, category: String }, { timestamps: true }));
const AutomationRule = model('AutomationRule', new Schema({
  org: ref('Organization', { index: true }), name: { type: String, required: true }, active: { type: Boolean, default: true },
  trigger: { type: String, enum: ['ticket.created', 'ticket.status_changed', 'ticket.idle'], default: 'ticket.created' },
  idleHours: { type: Number, default: 24 },
  conditions: [{ field: String, op: { type: String, default: 'eq' }, value: String, _id: false }],
  actions: [{ type: { type: String }, value: String, _id: false }]
}, { timestamps: true }));
const Notification = model('Notification', new Schema({ org: ObjId, user: ref('User', { index: true }), type: String, message: String, ticket: ref('Ticket'), read: { type: Boolean, default: false } }, { timestamps: true }));
const SavedFilter = model('SavedFilter', new Schema({ org: ObjId, user: ref('User', { index: true }), name: String, query: Schema.Types.Mixed }, { timestamps: true }));
const ApiKey = model('ApiKey', new Schema({ org: ref('Organization', { index: true }), name: String, prefix: String, hash: { type: String, index: true }, lastUsed: Date }, { timestamps: true }));
const Webhook = model('Webhook', new Schema({ org: ref('Organization', { index: true }), url: { type: String, required: true }, events: [String], secret: String, active: { type: Boolean, default: true } }, { timestamps: true }));
const AuditLog = model('AuditLog', new Schema({ org: ObjId, user: ref('User'), action: String, entity: String, entityId: String, meta: Schema.Types.Mixed }, { timestamps: true }));

module.exports = { Organization, User, Department, Counter, Ticket, Settings, KBArticle, CannedResponse, AutomationRule, Notification, SavedFilter, ApiKey, Webhook, AuditLog };
