const logger = require('../../logger');
const cronJob = require('cron').CronJob;
const ohip = require('./index');
const shared = require('../../server/shared');

const SERVICE_NAME = process.env.SERVICE_NAME || `Apply OHIP Remittance Advice Files`;

class ProcessRAFiles {

    constructor(config) {
        config = config || {};
        this.cronExpression = config.cron || '00 */30 * * * *';
        this.inProgress = false;
        this.restartInterval = config.interval || 60000; /// in milliseconds
    }

    async start() {
        logger.logInfo(` Initialized ${process.env.SERVICE_NAME} service`);

        let company_id = await shared.getCompanyId();

        if (!company_id) {
            logger.logError(`[${SERVICE_NAME}] - No company_id to use for connection to billing - `, e);
            return false;
        }

        new cronJob(this.cronExpression, async () => {
            this.inProgress = false;

            if (this.inProgress) {
                logger.logInfo(`${SERVICE_NAME} still running for downloading RA files for old batch of providers!`);
                return;
            }

            this.inProgress = true;
            this.cronTicks = 0;
            logger.logInfo('Started Fetching Details....');

            let remittanceFilesList = await shared.getRemittanceFiles(company_id);

            if (!remittanceFilesList.length) {
                logger.logInfo(`[${SERVICE_NAME}] - No pending remittance advice files to process...`);
                this.inProgress = false;
                return false;
            }

            try {
                await ohip.processRemittanceFiles(remittanceFilesList, (err, res) => {

                    if (err) {
                        logger.error(`Error in processing remittance advice files ${JSON.stringify(err)}`);
                        this.inProgress = false;
                    }

                    logger.logInfo(`${process.env.SERVICE_NAME} service completed processing remittance advice files`);
                    this.inProgress = false;
                });

            } catch (error) {
                logger.logError(`Error occured in processing remittance advice files ${JSON.stringify(error)}`);
                this.inProgress = false;
                return false;
            }

        }, null, true);
    }
}

module.exports = ProcessRAFiles;
