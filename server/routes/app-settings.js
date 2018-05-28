const Router = require('express-promise-router');
var router = new Router();

const appSettingsController = require('../controller/app-settings');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    req.params.companyID=1;
    req.params.userID=2;
    const data = await appSettingsController.getData(req.params);
    httpHandler.sendRows(req, res, data);
});
module.exports = router;
