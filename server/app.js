const express = require('express');
const logger = require('../logger');

const config = require('./config');
const ediConnect = require('../modules/edi');

const initializeWeb = async function () {
    logger.info('Initializing web..');

    await config.initialize();
    ediConnect.init(config.get('ediServerUrl') || 'http://localhost:5581/edi/api');

    require('./config/express')(app, express);
};

const app = express();
module.exports = app;
initializeWeb();
