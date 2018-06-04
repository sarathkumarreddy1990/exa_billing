const express = require('express');
const config = require('../../config');

const gridDefaults = require('./grid-defaults');
const auditDefaults = require('./audit-defaults');

const app = express();

app.use(function (req, res, next) {
    if (req.originalUrl.indexOf('i18n') == -1 || req.originalUrl.indexOf('wado/v1') == -1) {
        res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }

    if (config.get('enableCORS')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('X-Super-Powered-By', 'VIZTEK EXA');
    res.setHeader('X-PID', process.pid);

    next();
});

app.use(gridDefaults);
app.use(auditDefaults);

module.exports = app;
