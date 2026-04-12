const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'product-service',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive fields from logs
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

module.exports = logger;
