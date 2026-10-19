require('dotenv').config();
const e = process.env;
module.exports = {
  port: +e.PORT || 5000,
  mongo: e.MONGO_URI || 'mongodb://127.0.0.1:27017/ticketdesk',
  jwtSecret: e.JWT_SECRET || 'dev-secret-change-me',
  clientUrl: e.CLIENT_URL || 'http://localhost:5173',
  redis: e.REDIS_URL || '',
  smtp: { host: e.SMTP_HOST, port: +e.SMTP_PORT || 587, user: e.SMTP_USER, pass: e.SMTP_PASS, from: e.SMTP_FROM || 'TicketDesk <no-reply@ticketdesk.local>' },
  aiUrl: e.AI_SERVICE_URL || '',
  anthropicKey: e.ANTHROPIC_API_KEY || '',
  llmModel: e.LLM_MODEL || 'claude-sonnet-5-5',
  slack: e.SLACK_WEBHOOK_URL || '',
  sentry: e.SENTRY_DSN || '',
  inboundSecret: e.INBOUND_EMAIL_SECRET || 'change-me',
  imap: { host: e.IMAP_HOST, port: +e.IMAP_PORT || 993, user: e.IMAP_USER, pass: e.IMAP_PASS, orgSlug: e.IMAP_ORG_SLUG || 'demo' },
  twilio: { sid: e.TWILIO_SID, token: e.TWILIO_TOKEN, from: e.TWILIO_WHATSAPP_FROM, orgSlug: e.WHATSAPP_ORG_SLUG || 'demo' },
  publicUrl: (e.PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, ''),
  isTest: e.NODE_ENV === 'test'
};
