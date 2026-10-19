// Ticket classification: Python ML service if AI_SERVICE_URL is set, else rule engine (English + Roman Urdu).
const env = require('../config/env');
const { STOP } = require('./similarity');
const CAT = {
  Account: ['login', 'log in', 'sign in', 'password', 'otp', 'account', 'locked', 'verification', 'khul nahi', 'login nahi', 'password bhool', 'account band'],
  IT: ['wifi', 'internet', 'laptop', 'printer', 'server', 'vpn', 'network', 'install', 'software', 'monitor', 'keyboard', 'computer', 'email setup', 'net nahi', 'printer nahi'],
  Billing: ['invoice', 'payment', 'refund', 'charged', 'billing', 'bill', 'receipt', 'subscription', 'paisay', 'paise', 'raqam', 'refund chahiye', 'payment nahi'],
  HR: ['leave', 'salary', 'payroll', 'attendance', 'hr', 'vacation', 'chutti', 'tankhwah', 'tankhuwah', 'contract'],
  Bug: ['bug', 'error', 'crash', 'exception', 'broken', 'not working', 'glitch', 'kaam nahi', 'chal nahi', 'kharab', 'hang'],
  Feature: ['feature', 'suggestion', 'enhancement', 'would be nice', 'add option', 'request', 'idea']
};
const PRI = {
  urgent: ['urgent', 'asap', 'emergency', 'server down', 'production', 'data loss', 'critical', 'security breach', 'hacked', 'fori', 'foran', 'bohat zaroori', 'abhi chahiye'],
  high: ['cannot', "can't", 'unable', 'failed', 'blocked', 'not working', 'down', 'nahi ho raha', 'nahi chal', 'nahi khul', 'jaldi'],
  low: ['question', 'how to', 'suggestion', 'feature', 'idea', 'kaise', 'info', 'would be nice']
};
const NEG = ['angry', 'worst', 'terrible', 'unacceptable', 'useless', 'frustrated', 'disappointed', 'ridiculous', 'third time', 'again', 'bakwas', 'bekar', 'ghalat', 'gussa', 'pareshan', 'tang', 'bura', 'zaleel', 'kab tak'];
const POS = ['thanks', 'thank you', 'great', 'appreciate', 'shukriya', 'meharbani', 'acha', 'achha'];
const has = (t, w) => (w.includes(' ') || w.length > 3 ? t.includes(w) : new RegExp('\\b' + w + '\\b').test(t));

function sentiment(text) {
  const t = text.toLowerCase();
  let score = 0;
  NEG.forEach(w => has(t, w) && (score -= 0.35));
  POS.forEach(w => has(t, w) && (score += 0.3));
  if (/!{2,}/.test(text)) score -= 0.25;
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && (text.match(/[A-Z]/g) || []).length / letters.length > 0.6) score -= 0.3;
  score = Math.max(-1, Math.min(1, score));
  return { score: +score.toFixed(2), label: score <= -0.3 ? 'negative' : score >= 0.3 ? 'positive' : 'neutral' };
}
const GENERIC = new Set('issue problem working getting since after when that with have been this there which would could should about again still just very some thing things'.split(' '));
// Frequency-based keyword extraction (longer / repeated words rank higher); works for English + Roman Urdu
function extractKeywords(text, n = 5) {
  const freq = {};
  text.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff\s]/g, ' ').split(/\s+/).forEach(w => {
    if (w.length > 3 && !STOP.has(w) && !GENERIC.has(w) && !/^\d+$/.test(w)) freq[w] = (freq[w] || 0) + 1 + Math.min(w.length, 10) / 20;
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
}
function byRules(text) {
  const t = text.toLowerCase();
  let category = 'General', best = 0; const tags = [];
  for (const [c, words] of Object.entries(CAT)) {
    const hit = words.filter(w => has(t, w));
    if (hit.length > best) { best = hit.length; category = c; }
    hit.slice(0, 2).forEach(h => tags.push(h.replace(/\s+/g, '-')));
  }
  let priority = 'medium';
  if (PRI.urgent.some(w => has(t, w))) priority = 'urgent';
  else if (PRI.high.some(w => has(t, w))) priority = 'high';
  else if (PRI.low.some(w => has(t, w))) priority = 'low';
  return { category, priority, sentiment: sentiment(text), tags: [...new Set([...tags, ...extractKeywords(text, 4)])].slice(0, 6), source: 'rules' };
}
async function classify(text) {
  const rules = byRules(text);
  if (!env.aiUrl) return rules;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(env.aiUrl + '/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: ctl.signal });
    clearTimeout(to);
    if (!r.ok) return rules;
    const ml = await r.json();
    return { ...rules, category: ml.categoryConfidence >= 0.4 ? ml.category : rules.category, priority: ml.priority || rules.priority, sentiment: ml.sentiment || rules.sentiment, tags: [...new Set([...(ml.keywords || []), ...rules.tags])].slice(0, 6), source: 'ml' };
  } catch { return rules; }
}
module.exports = { classify, byRules, sentiment, extractKeywords };
