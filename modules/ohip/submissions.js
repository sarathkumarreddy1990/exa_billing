const logger = require('../../logger');
const cronJob = require('cron').CronJob;
const {
    submitClaims
} = require('./ebsClaimSubmission')

class Submissions {

    constructor(config) {
        config = config || {};
        this.cronExpression = config.cron || '* * * * *';
        this.inProgress = false;
        this.restartInterval = config.interval || 60000; /// in milliseconds
    }

    start() {
        logger.info(` Initialized ${process.env.SERVICE_NAME} service`);

        new cronJob(this.cronExpression, async () => {
            if (this.inProgress) {

                logger.logInfo(`${process.env.SERVICE_NAME} Initiated batch is going on.. waiting to complete existing batch`);
                return;
            }

            this.inProgress = true;
            this.cronTicks = 0;
            logger.info('Started Fetching Details....');

            await submitClaims((err, res) => {
                if (err) {
                    logger.error(`Error in claim submission ${err}`);
                }

                logger.logInfo(`${process.env.SERVICE_NAME} service successful`);

                this.inProgress = false;
            });

        }, null, true);
    }
}

module.exports = Submissions;
