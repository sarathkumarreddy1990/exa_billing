const Router = require('express-promise-router');
const router = new Router();

const reportSettingsController = require('../controllers/report-settings');
const httpHandler = require('../shared/http');

router.get('/getReportSetting', async function (req, res) {
    const data = await reportSettingsController.getReportSetting(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
