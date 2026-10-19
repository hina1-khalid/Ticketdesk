const winston = require('winston');
const env = require('./env');
module.exports = winston.createLogger({
  level: 'info', silent: env.isTest,
  format: winston.format.combine(winston.format.timestamp(), winston.format.printf(i => `${i.timestamp} ${i.level}: ${i.message}`)),
  transports: [new winston.transports.Console(), new winston.transports.File({ filename: 'logs/error.log', level: 'error' }), new winston.transports.File({ filename: 'logs/app.log' })]
});
