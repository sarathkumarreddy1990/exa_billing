const split = require('split2');
const pump = require('pump');
const through = require('through2');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../../log');

const logFileName = process.env.LOG_FILE_NAME || 'billing-combined.log';

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const stream = pino.destination(path.join(logDir, logFileName));
const logger = pino({
    level: 'info',
    crlf: true,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level(label) {
            return { level: label };
        }
    },
}, stream);

logger.info('logger initialized..');

const myTransport = through.obj(function (chunk, enc, cb) {

    if (logger[chunk.level]) {
        logger[chunk.level](chunk);
    } else {
        logger.info(chunk);
    }

    cb();
});

pump(process.stdin, split(JSON.parse), myTransport);
