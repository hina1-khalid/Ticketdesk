process.env.NODE_ENV = 'test';
const { addBusinessMinutes } = require('../src/services/sla');
const { byRules } = require('../src/services/classifier');
const { jaccard, tokens } = require('../src/services/similarity');
const { can } = require('../src/permissions');
const bh = { startHour: 9, endHour: 18, days: [1, 2, 3, 4, 5], utcOffsetMinutes: 0 };

test('SLA: stays inside business hours', () => {
  expect(addBusinessMinutes(new Date('2025-01-06T10:00:00Z'), 60, bh).toISOString()).toBe('2025-01-06T11:00:00.000Z'); // Monday
  expect(addBusinessMinutes(new Date('2025-01-10T17:30:00Z'), 60, bh).toISOString()).toBe('2025-01-13T09:30:00.000Z'); // Fri evening -> Mon
});
test('SLA: skips holidays', () => {
  expect(addBusinessMinutes(new Date('2025-01-06T17:00:00Z'), 120, bh, ['2025-01-07']).toISOString()).toBe('2025-01-08T10:00:00.000Z');
});
test('Classifier understands Roman Urdu', () => {
  expect(byRules('mera login nahi ho raha').category).toBe('Account');
  expect(byRules('payment nahi ho rahi, refund chahiye').category).toBe('Billing');
  expect(byRules('URGENT server down in production').priority).toBe('urgent');
  expect(byRules('This is the worst service, totally unacceptable!!').sentiment.label).toBe('negative');
});
test('Similarity finds near-duplicates', () => {
  expect(jaccard(tokens('printer not working floor two'), tokens('printer not working on floor 2'))).toBeGreaterThan(0.4);
});
test('Permissions: defaults and overrides', () => {
  expect(can({}, 'user', 'ticket:create')).toBe(true);
  expect(can({}, 'user', 'ticket:view_all')).toBe(false);
  expect(can({ viewer: ['ticket:view_all'] }, 'viewer', 'ticket:view_all')).toBe(true);
  expect(can({}, 'admin', 'settings:manage')).toBe(true);
});

const { holt } = require('../src/services/stats');
const { extractKeywords } = require('../src/services/classifier');
const { normPhone, validSignature } = require('../src/services/whatsapp');
test('Holt forecast follows a trend and flat series', () => {
  const up = holt([10, 12, 14, 16, 18, 20], 2); expect(up.points[0].count).toBeGreaterThanOrEqual(21); expect(up.points[0].count).toBeLessThanOrEqual(23); expect(up.points[1].count).toBeGreaterThan(up.points[0].count);
  expect(holt([5, 5, 5, 5, 5], 1).points[0].count).toBe(5);
  expect(holt([1, 2], 1)).toBeNull();
});
test('Keyword extraction ignores stop words', () => {
  const k = extractKeywords('The printer on floor two keeps jamming. Printer jamming again and again', 3);
  expect(k).toContain('printer'); expect(k).toContain('jamming'); expect(k).not.toContain('the');
});
test('Phone normalisation (Pakistan formats)', () => {
  expect(normPhone('0300-1234567')).toBe('+923001234567'); expect(normPhone('923001234567')).toBe('+923001234567'); expect(normPhone('+14155238886')).toBe('+14155238886'); expect(normPhone('abc')).toBe('');
});
test('Twilio signature check', () => {
  const crypto = require('crypto'), params = { Body: 'hi', From: 'whatsapp:+923001234567' };
  const sig = crypto.createHmac('sha1', 'tok').update('https://x.test/api/inbound/whatsappBodyhiFromwhatsapp:+923001234567').digest('base64');
  expect(validSignature('https://x.test/api/inbound/whatsapp', params, sig, 'tok')).toBe(true);
  expect(validSignature('https://x.test/api/inbound/whatsapp', params, sig.replace(/.$/, 'A'), 'tok')).toBe(false);
});
