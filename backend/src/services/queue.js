// Background jobs: BullMQ when REDIS_URL is set, otherwise run inline (async).
const env = require('../config/env');
const logger = require('../config/logger');
const handlers = {};
let queue = null;
exports.register = (name, fn) => { handlers[name] = fn; };
exports.init = () => {
  if (!env.redis || queue) return;
  const { Queue, Worker } = require('bullmq');
  const IORedis = require('ioredis');
  queue = new Queue('jobs', { connection: new IORedis(env.redis, { maxRetriesPerRequest: null }) });
  new Worker('jobs', async job => handlers[job.name](job.data), { connection: new IORedis(env.redis, { maxRetriesPerRequest: null }) });
  logger.info('BullMQ queue started');
};
exports.add = (name, data) => {
  if (queue) return queue.add(name, data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 100 });
  setImmediate(() => Promise.resolve(handlers[name] && handlers[name](data)).catch(e => logger.error(`job ${name}: ${e.message}`)));
};
