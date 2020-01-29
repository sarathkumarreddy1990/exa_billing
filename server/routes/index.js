const express = require('express');
const router = express.Router();

const httpHandler = require('../shared/http');
const pkg = require('../../package.json');
const { staticAssetsRoot } = require('../shared/constants');
const logger = require('../../logger');
const autobillingController = require('../controllers/setup/auto-billing');

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

router.post('/studyStatusChanged', async (req, res) => {
    // TODO now actually implement rule execution
    const abrResults = await autobillingController.executeAutobillingRules(req.body);
    httpHandler.send(req, res, abrResults);
});

module.exports = router;
