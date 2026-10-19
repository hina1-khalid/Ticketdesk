const env = require('../config/env');
let redis = null;
if (env.redis) { const IORedis = require('ioredis'); redis = new IORedis(env.redis, { maxRetriesPerRequest: null }); redis.on('error', () => {}); }
const mem = new Map();
async function get(k) {
  if (redis) { const v = await redis.get(k); return v ? JSON.parse(v) : null; }
  const e = mem.get(k); if (!e || e.exp < Date.now()) { mem.delete(k); return null; } return e.v;
}
async function set(k, v, ttl = 60) { if (redis) return redis.set(k, JSON.stringify(v), 'EX', ttl); mem.set(k, { v, exp: Date.now() + ttl * 1000 }); }
async function delPrefix(p) {
  if (redis) { const keys = await redis.keys(p + '*'); if (keys.length) await redis.del(keys); }
  else for (const k of [...mem.keys()]) if (k.startsWith(p)) mem.delete(k);
}
async function wrap(k, ttl, fn) { const c = await get(k); if (c !== null) return c; const v = await fn(); await set(k, v, ttl); return v; }
module.exports = { get, set, delPrefix, wrap, redis };
