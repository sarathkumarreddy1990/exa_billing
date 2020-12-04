const logger = require('./../modules/logger');

logger.initialize({
    fileName: process.env.LOG_FILE_NAME || 'billing.log',
});

module.exports = logger.instance;
