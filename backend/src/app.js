require('express-async-errors');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const env = require('./config/env');
const logger = require('./config/logger');

const app = express();
if (env.sentry) { var Sentry = require('@sentry/node'); Sentry.init({ dsn: env.sentry }); }
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
if (!env.isTest) app.use(morgan('tiny', { stream: { write: m => logger.info(m.trim()) } }));
const noop = (q, s, n) => n();
const limiter = (max, windowMs) => (env.isTest ? noop : rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests, slow down' } }));
app.use('/api', limiter(600, 15 * 60 * 1000));
app.use('/api/auth/login', limiter(20, 15 * 60 * 1000));
app.use('/api/auth/register', limiter(10, 60 * 60 * 1000));
app.use('/api/inbound', limiter(60, 60 * 1000));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { setHeaders: r => r.setHeader('Content-Disposition', 'attachment') }));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(require('./openapi')));

app.get('/api/health', (q, s) => s.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/users', require('./routes/users'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/config'));
app.use('/api', require('./routes/misc'));
app.use('/api', (q, s) => s.status(404).json({ message: 'Not found' }));

if (Sentry) Sentry.setupExpressErrorHandler(app);
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'CastError' || err.name === 'ValidationError') return res.status(400).json({ message: 'Invalid input: ' + err.message });
  if (err.code === 11000) return res.status(409).json({ message: 'Duplicate value' });
  if (err.name === 'MulterError' || /File type/.test(err.message)) return res.status(400).json({ message: err.message });
  logger.error(err.stack || err.message);
  res.status(500).json({ message: 'Something went wrong' });
});
module.exports = app;
