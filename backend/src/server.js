const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { User } = require('./models');
const rt = require('./services/realtime');
const queue = require('./services/queue');
const jobs = require('./services/jobs');

(async () => {
  await mongoose.connect(env.mongo);
  logger.info('MongoDB connected');
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: env.clientUrl } });
  io.use(async (socket, next) => {
    try { const { id } = jwt.verify(socket.handshake.auth.token, env.jwtSecret); const u = await User.findById(id).select('org'); if (!u) throw new Error(); socket.data.user = u; next(); } catch { next(new Error('auth')); }
  });
  io.on('connection', s => { s.join('user:' + s.data.user._id); s.join('org:' + s.data.user.org); });
  rt.setIO(io);
  queue.init();
  jobs.start();
  server.listen(env.port, () => logger.info(`API on :${env.port}  docs: /api/docs`));
})().catch(e => { logger.error(e.stack); process.exit(1); });
