const express = require('express');
const logger = require('../logger');

const config = require('./config');
config.initialize();

const app = express();

logger.info('Initializing web..');
require('./config/express')(app, express);

module.exports = app;
