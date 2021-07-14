const logger = require('../../logger');
const cronJob = require('cron').CronJob;
const ohip = require('./index');
const shared = require('../../server/shared');

const SERVICE_NAME = process.env.SERVICE_NAME || `OHIP Response Files`;

class AckDownloads {

    constructor(config) {
        config = config || {};
        this.cronExpression = config.cron || '*/1 * * * * *';
        this.inProgress = false;
        this.restartInterval = config.interval || 60000; /// in milliseconds
    }

    async startProcess(providerNumber) {

        try {
            await ohip.downloadAndProcessResponseFiles({ 
                providerNumber: providerNumber
            }, function (err, res) {
                logger.logInfo(err || res);                
            })

        } catch (error) {
            logger.logError(`Error connecting OHIP Endpoint for provider ${providerNumber} - ${JSON.stringify(error)}`);
            return false;
        }
    };

    async start() {
        logger.info(`Initialized ${SERVICE_NAME} service`);

        let company_id = 0;

        company_id = await shared.getCompanyId();

        if (!company_id) {
            logger.logError(`[${SERVICE_NAME}] - No company_id to use for connection to billing - `, e);
            return false;
        }        

        new cronJob(this.cronExpression, async () => {
            if (this.inProgress) {

                logger.logInfo(`${SERVICE_NAME} Initiated download process...`);
                return;
            }

            this.inProgress = true;
            this.cronTicks = 0;
            logger.info('Started Fetching Details....');

            let providerNumbersList = [];
            providerNumbersList = await shared.getProviderNumbers(company_id);

            if (!providerNumbersList.length) {
                logger.logError(`[${SERVICE_NAME}] - No Provider Numbers available for the providers to continue...`);
                this.inProgress = false;
                return false;
            }
  
            for (const details of providerNumbersList) {
                await this.startProcess(details.providerNumber);
            }

            this.inProgress = false;

        }, null, true);
    }
}

module.exports = AckDownloads;
