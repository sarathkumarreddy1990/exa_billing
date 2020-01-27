const express = require('express');
const router = express.Router();

const httpHandler = require('../shared/http');
const pkg = require('../../package.json');
const { staticAssetsRoot } = require('../shared/constants');
const logger = require('../../logger');

router.get('/', function (req, res) {
    let currentTheme = 'default';
    const countryCode = req.session && req.session.country_alpha_3_code
        ? req.session.country_alpha_3_code
        : 'usa';

    if (req.session && req.session.currentTheme && ['default', 'dark'].indexOf(req.session.currentTheme) > -1) {
        currentTheme = req.session.currentTheme;
    }

    res.render('index', {
        title: 'EXA-Billing',
        cssPath: staticAssetsRoot + '/skins/' + currentTheme,
        countryCode: countryCode,
        staticAssetsRoot
    });
});

router.get('/about', function (req, res) {
    httpHandler.send(req, res, {
        version: pkg.version
    });
});

router.post('/studyStatusChanged', (req, res) => {
    logger.info('STUDY STATUS CHANGED', req.body);
    res.send('okay');
});

module.exports = router;
