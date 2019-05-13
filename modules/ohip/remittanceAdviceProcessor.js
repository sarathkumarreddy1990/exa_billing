'use strict';

(async function () {
    const logger = require('./../../logger');
    const parseFile = async (req) => {

        process.send({
            status:'InProgress',
            message : 'OHIP Payment in progress'
        });

        logger.info(`Initializing configuration file for OHIP payment process`);

        const config = require('../../server/config/index');
        await config.initialize();

        logger.info(`OHIP payment process started (${process.pid})`);

        const eraParser = require('./../../server/data/ohip/ohip-era-parser');
        let processedClaims = await eraParser.processOHIPEraFile(req.f_c, req.args);

        logger.info(`OHIP payment process ended (${process.pid})`);

        if (!processedClaims) {
            logger.info(`OHIP process exit (${process.pid})`);
            process.exit(0);
        }
    };

    process.on('message', parseFile);
    logger.info(`OHIP process started (${process.pid})`);
})();
