const express = require('express');
const logger = require('../logger');

const config = require('./config');
const ediConnect = require('../modules/edi');

config.initialize();

ediConnect.init(config.get('ediServerUrl') || 'http://localhost:5581/edi/api');

const app = express();

logger.info('Initializing web..');
require('./config/express')(app, express);

module.exports = app;
