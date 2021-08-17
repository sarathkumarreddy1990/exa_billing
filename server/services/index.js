'use strict';

for (let argv of process.argv) {
    if (argv.indexOf('NODE_ENV') > -1) {
        process.env.NODE_ENV = argv.split('=')[1];
    } else if (argv.indexOf('SERVICE_NAME') > -1) {
        process.env.SERVICE_NAME = argv.split('=')[1];
    }
}

process.env.LOG_FILE_NAME = `${process.env.SERVICE_NAME}.log`;

const logger = require('../../logger');
const config = require('../config');

/**
 * @description To create service based on environment
 */
const startService = async () => {
    switch (process.env.SERVICE_NAME) {

        case 'ohip-submissions': {
            const Submissions = require('../../modules/ohip/submissions');
            const submissions = new Submissions({
                //cron:  need to get from config
            });
            submissions.start();
            break;
        }

        case 'ohip-ack-downloads': {
            const AckDownloads = require('../../modules/ohip/ackDownloads');
            const ackDownloads = new AckDownloads({
                //cron:  need to get from config
            });
            ackDownloads.start();
            break;
        }

        case 'ohip-ra-downloads': {
            const RaDownloads = require('../../modules/ohip/raDownloads');
            const raDownloads = new RaDownloads({
                //cron:  need to get from config
            });
            raDownloads.start();
            break;
        }

        case 'ohip-ra-process': {
            const ApplyRemittanceAdvice = require('../../modules/ohip/processRemittanceFiles');
            const applyRAFiles = new ApplyRemittanceAdvice({
                //cron:  need to get from config
            });
            applyRAFiles.start();
            break;
        }

        default: {
            logger.logError(' Service not supplied through environment ');
            process.exit();
        }
    }
};

config.initialize(false)
    .then(startService)
    .catch(err => {
        logger.logError('Configuration Initialization Failed', err);
        process.exit();
    });

process.on('uncaughtException', err => {
    logger.logError('Uncaught Exception in service', err);
    process.exit();
});

process.on('unhandledRejection', err => {
    logger.logError('Unhandled Rejection in service', err);
    process.exit();
});
