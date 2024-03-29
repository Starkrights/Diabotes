// github.com/headline/discord-compiler-bot
import winston from 'winston';
const {createLogger, format, transports} = winston;
const { label, combine, timestamp, printf, colorize } = format;

  const log = createLogger({
    level: 'info',
    format: combine(
        colorize({
            debug: 'blue',
            verbose: 'white',
            info: 'green',
            warn: 'yellow',
            error: 'red',
        }),
        label({
            label: `Diabotes`,
        }),
        timestamp(),
        printf(({ level, message, label, timestamp}) => {
            return `${timestamp} [${label}] ${level}: ${message}`;
        })
    ),
    levels: {
        debug: 4,
        info: 3,
        verbose: 2,
        warn: 1,
        error: 0,
    },
    transports: [
        new transports.Console()
    ]
  });
export default log;
