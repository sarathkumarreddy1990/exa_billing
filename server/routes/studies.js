const Router = require('express-promise-router');
const router = new Router();

const studiesController = require('../controllers/studies');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    req.query.company_id = req.query.companyId;
    req.query.user_id = req.query.userId;
    const data = await studiesController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/studies_total_records', async function (req, res) {
    req.query.company_id = req.query.companyId;
    req.query.user_id = req.query.userId;
    const data = await studiesController.getDataCount(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:fromDate/:toDate', async function (req, res) {
    const data = await studiesController.getDataByDate(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
