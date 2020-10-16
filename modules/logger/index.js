const pino = require('pino');
const path = require('path');
const fs = require('fs');

const LOG_FOLDER = '../../../log';

class Logger {
    constructor() {
        this.initialized = false;

        this.loggerInstance = null;

        this.enableStdout = process.env.ENABLE_STDOUT === 'true';
        this.enableAsyncLog = process.env.ENABLE_ASYNC_LOG === 'true';
        this.disableLogging = process.env.DISABLE_LOGGING === 'true';
        this.logLevel = process.env.LOG_LEVEL || 'debug';
    }

    get instance() {
        if (!this.loggerInstance) {
            throw new Error('Logger has not been initialized yet.');
        }

        return this.loggerInstance;
    }

    initialize(options) {
        if (this.initialized) {
            return;
        }

        options = options || {};

        this.logFileName = options.fileName || 'exa-billing.log';

        const logDir = path.join(__dirname, LOG_FOLDER);

        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }

        const stream = {
            sync: !this.enableAsyncLog,
        };

        if (!this.enableStdout) {
            stream.dest = path.join(logDir, this.logFileName);
        }

        this.loggerInstance = pino({
            level: this.logLevel,
            crlf: true,
            enabled: !this.disableLogging,
            timestamp: pino.stdTimeFunctions.isoTime,

            formatters: {
                /**
                 * log level formatter
                 * '10': 'trace',
                 * '20': 'debug',
                 * '30': 'info',
                 * '40': 'warn',
                 * '50': 'error',
                 * '60': 'fatal'
                 * @param {*} label
                 */
                level(label) {
                    return { level: label };
                }
            },
        }, pino.destination(stream));

        /// Async mode - log loss prevention
        if (this.enableAsyncLog) {
            this.initAsyncLossHandler();
        }

        this.initialized = true;
        this.loggerInstance.info(`Logger file path[if enabled] ${path.join(logDir, this.logFileName)}`);

        /// functions required for backward compatibility :)
        this.loggerInstance.logInfo = this.logInfo;
        this.loggerInstance.logError = this.logError;
    }

    initAsyncLossHandler() {
        this.loggerInstance.trace('Async mode enabled: Initializing async log loss prevention');

        /// Flushing every 10 secs to keep the buffer empty
        setInterval(() => {
            this.loggerInstance.flush();
        }, 10000).unref();

        const handler = pino.final(this.loggerInstance, (err, finalLogger, evt) => {
            finalLogger.info(`${evt} caught`);

            if (err) {
                finalLogger.error(err, 'error caused exit');
            }

            process.exit(err ? 1 : 0);
        });

        process.on('beforeExit', () => handler(null, 'beforeExit'));
        process.on('exit', () => handler(null, 'exit'));
        process.on('uncaughtException', (err) => handler(err, 'uncaughtException'));
        process.on('SIGINT', () => handler(null, 'SIGINT'));
        process.on('SIGQUIT', () => handler(null, 'SIGQUIT'));
        process.on('SIGTERM', () => handler(null, 'SIGTERM'));
    }

    /**
     * @deprecated - use logger.info() instead
     * @param {string} message
     * @param {string} metaData
     */
    logInfo(message, metaData) {
        metaData = metaData || {};
        this.info(metaData, message);
    }

    /**
     * @deprecated - use logger.error() instead
     * @param {string} message
     * @param {string} metaData
     */
    logError(message, metaData) {
        let messageString = typeof message === 'string'
            ? message
            : JSON.stringify(message);

        if (!metaData) {
            metaData = {};
        }

        if (!metaData.callStack) {
            try {
                const stack = new Error().stack;
                metaData.callstack = stack.toString();
            } catch (err) {
                metaData.callstack = '';
            }
        }

        this.error(metaData, messageString);
    }
}

module.exports = new Logger();
