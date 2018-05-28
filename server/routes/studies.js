const Router = require('express-promise-router');
var router = new Router();

const studiesController = require('../controllers/studies');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await studiesController.getData();
    httpHandler.sendRows(req, res, data);
});

router.get('/:fromDate/:toDate', async function (req, res) {
    const data = await studiesController.getDataByDate(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
