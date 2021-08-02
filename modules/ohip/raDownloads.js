const logger = require('../../logger');
const cronJob = require('cron').CronJob;
const ohip = require('./index');
const shared = require('../../server/shared');

const SERVICE_NAME = process.env.SERVICE_NAME || `OHIP Remittance Advice Files`;
class RaDownloads {

    constructor(config) {
        config = config || {};
        this.cronExpression = config.cron || '00 */10 * * * *';
        this.inProgress = false;
        this.restartInterval = config.interval || 60000; /// in milliseconds
    }

    async start() {
        logger.info(` Initialized ${process.env.SERVICE_NAME} service`);

        let company_id = await shared.getCompanyId();

        if (!company_id) {
            logger.logError(`[${SERVICE_NAME}] - No company_id to use for connection to billing - `, e);
            return false;
        }

        new cronJob(this.cronExpression, async () => {
            if (this.inProgress) {

                logger.logInfo(`${SERVICE_NAME} still running for downloading RA files for old batch of providers!`);
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
                await ohip.downloadRemittanceFiles(providerNumbersList, (err, res) => {

                    if (err) {
                        logger.error(`Error in downloading remittance advice files ${err}`);
                    }

                    logger.logInfo(`${process.env.SERVICE_NAME} service completed downloading remittance advice files`);
                    this.inProgress = false;
                });

            } catch (error) {
                logger.logError(`Error occured in downloading ack files ${JSON.stringify(error)}`);
                this.inProgress = false;
                return false;
            }

        }, null, true);
    }
}

module.exports = RaDownloads;
