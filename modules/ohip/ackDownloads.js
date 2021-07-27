const logger = require('../../logger');
const cronJob = require('cron').CronJob;
const ohip = require('./index');
const shared = require('../../server/shared');

const SERVICE_NAME = process.env.SERVICE_NAME || `OHIP Response Files`;

class AckDownloads {

    constructor(config) {
        config = config || {};
        this.cronExpression = config.cron || '*/2 * * * *';
        this.inProgress = false;
        this.restartInterval = config.interval || 60000; /// in milliseconds
    }

    async start() {
        logger.info(`Initialized ${SERVICE_NAME} service`);

        let company_id = await shared.getCompanyId();

        if (!company_id) {
            logger.logError(`[${SERVICE_NAME}] - No company_id to use for connection to billing - `, e);
            return false;
        }

        new cronJob(this.cronExpression, async () => {
            if (this.inProgress) {

                logger.logInfo(`${SERVICE_NAME} still running for downloading response files of old batch of providers!`);
                return;
            }

            this.inProgress = true;
            this.cronTicks = 0;
            logger.info('Started Fetching Details....');

            let providerNumbersList = await shared.getProviderNumbers(company_id);

            if (!providerNumbersList.length) {
                logger.logError(`[${SERVICE_NAME}] - No Provider Numbers available for the providers to continue...`);
                this.inProgress = false;
                return false;
            }

            try {
                await ohip.downloadSubmittedFiles(providerNumbersList, (err, res) => {
                    if (err) {
                        logger.error(`Error in downloading ack files ${err}`);
                    }

                    logger.logInfo(`${process.env.SERVICE_NAME} service completed downloading response files`);
                    this.inProgress = false;
                });
            } catch (e) {
                logger.error(`Error occured in downloading ack files ${e}`);
                this.inProgress = false;
            }

        }, null, true);
    }
}

module.exports = AckDownloads;
