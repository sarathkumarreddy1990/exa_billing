const Router = require('express-promise-router');
var router = new Router();

const appSettingsController = require('../controller/app-settings');
const i18nData = require('../shared/i18n');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    req.params.companyID = 1;
    req.params.userID = 2;
    const data = await appSettingsController.getData(req.params);
    httpHandler.sendRows(req, res, data);
});

router.get('/i18n/:culture', async function (req, res) {

    let { culture } = req.params;

    if (!culture) {
        return httpHandler.sendError(req, res, { code: 'INVALID LANG' }, null);
    }

    if (culture === 'undefined.json') {
        culture = 'default.json';
    }

    let data = await i18nData.getI18nData(culture);
    httpHandler.send(req, res, data);
});

module.exports = router;
