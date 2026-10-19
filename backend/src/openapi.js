const j = (d, extra = {}) => ({ description: d, ...extra });
const sec = [{ bearer: [] }];
module.exports = {
  openapi: '3.0.3',
  info: { title: 'TicketDesk API', version: '1.0.0', description: 'Internal API (JWT bearer) and public API v1 (x-api-key).' },
  servers: [{ url: '/api' }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } },
  paths: {
    '/auth/register': { post: { tags: ['Auth'], summary: 'Register (new org => admin, or join with orgSlug)', responses: { 201: j('Created') } } },
    '/auth/login': { post: { tags: ['Auth'], summary: 'Login (send otp when 2FA enabled)', responses: { 200: j('Token') } } },
    '/auth/me': { get: { tags: ['Auth'], security: sec, summary: 'Current user + permissions', responses: { 200: j('OK') } } },
    '/auth/2fa/setup': { post: { tags: ['Auth'], security: sec, summary: 'Start TOTP setup (returns QR)', responses: { 200: j('OK') } } },
    '/tickets': {
      get: { tags: ['Tickets'], security: sec, summary: 'List/search tickets', parameters: ['q', 'status', 'priority', 'category', 'assignee', 'breached', 'archived', 'sort', 'page', 'limit'].map(n => ({ name: n, in: 'query', schema: { type: 'string' } })), responses: { 200: j('OK') } },
      post: { tags: ['Tickets'], security: sec, summary: 'Create ticket (multipart, attachments[])', responses: { 201: j('Created') } }
    },
    '/tickets/suggest': { post: { tags: ['Tickets'], security: sec, summary: 'AI category/priority, duplicates, KB articles, ETA', responses: { 200: j('OK') } } },
    '/tickets/export': { get: { tags: ['Tickets'], security: sec, summary: 'Export CSV or PDF (?format=csv|pdf)', responses: { 200: j('File') } } },
    '/tickets/import': { post: { tags: ['Tickets'], security: sec, summary: 'Import CSV', responses: { 200: j('Result') } } },
    '/tickets/bulk': { post: { tags: ['Tickets'], security: sec, summary: 'Bulk assign/status/tag/archive/delete', responses: { 200: j('OK') } } },
    '/tickets/{id}': { get: { tags: ['Tickets'], security: sec, summary: 'Ticket detail', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: j('OK') } } },
    '/tickets/{id}/status': { post: { tags: ['Tickets'], security: sec, summary: 'Change status', responses: { 200: j('OK') } } },
    '/tickets/{id}/assign': { post: { tags: ['Tickets'], security: sec, summary: 'Assign (empty = auto-assign)', responses: { 200: j('OK') } } },
    '/tickets/{id}/comments': { post: { tags: ['Tickets'], security: sec, summary: 'Comment or internal note (@mentions)', responses: { 201: j('Created') } } },
    '/tickets/{id}/merge': { post: { tags: ['Tickets'], security: sec, summary: 'Merge into another ticket', responses: { 200: j('OK') } } },
    '/tickets/{id}/feedback': { post: { tags: ['Tickets'], security: sec, summary: 'CSAT rating 1-5', responses: { 200: j('OK') } } },
    '/analytics/overview': { get: { tags: ['Analytics'], security: sec, summary: 'Dashboard stats', responses: { 200: j('OK') } } },
    '/analytics/agents': { get: { tags: ['Analytics'], security: sec, summary: 'Agent performance', responses: { 200: j('OK') } } },
    '/analytics/forecast': { get: { tags: ['Analytics'], security: sec, summary: 'Weekly volume forecast', responses: { 200: j('OK') } } },
    '/analytics/anomalies': { get: { tags: ['Analytics'], security: sec, summary: 'Spike detection', responses: { 200: j('OK') } } },
    '/public/track/{code}': { get: { tags: ['Public'], summary: 'Track ticket by ID (no login)', parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: j('OK'), 404: j('Not found') } } },
    '/inbound/email': { post: { tags: ['Public'], summary: 'Email-to-ticket (header x-inbound-secret)', responses: { 201: j('Created') } } },
    '/v1/tickets': {
      get: { tags: ['Public API'], security: [{ apiKey: [] }], summary: 'List tickets', responses: { 200: j('OK') } },
      post: { tags: ['Public API'], security: [{ apiKey: [] }], summary: 'Create ticket {title, description, requesterEmail}', responses: { 201: j('Created') } }
    },
    '/v1/powerbi/tickets': { get: { tags: ['Public API'], security: [{ apiKey: [] }], summary: 'Flat dataset for Power BI', responses: { 200: j('OK') } } }
  }
};
