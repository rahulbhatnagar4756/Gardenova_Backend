import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  levels: winston.config.npm.levels,  // ← wapas add karo
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const extra = Object.keys(meta).length ? JSON.stringify(meta) : '';
              return `[${timestamp}] ${level}: ${message} ${extra}`;
            })
          )
    }),
  ]
});

export default logger;