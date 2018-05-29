const Router = require('express-promise-router');
var router = new Router();
const claimFiltersController = require('../controllers/claim-filters');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await claimFiltersController.getData();
    httpHandler.sendRows(req, res, data);
});

module.exports = router;