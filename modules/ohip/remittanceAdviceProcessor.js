'use strict';

(async function () {
    const logger = require('./../../logger');
    const parseFile = async (req) => {

        process.send({
            status:'InProgress',
            message : 'OHIP Payment in progress'
        });

        const config = require('../../server/config/index');

        await config.initialize();

        const era_parser = require('./../../server/data/ohip/ohip-era-parser');


        let processedClaims = await era_parser.processOHIPEraFile(req.f_c, req.args);

        if (!processedClaims) {
            process.exit(0);
        }
    };

    process.on('message', parseFile);
    logger.info(`OHIP process started (${process.pid})`);
})();
