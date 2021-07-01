const Router = require('express-promise-router');
const router = new Router();
const censusController = require('../controllers/census');
const httpHandler = require('../shared/http');

router.get('/', async (req, res) => {
    req.query.company_id = req.query.companyId;
    req.query.user_id = req.query.userId;
    const data = await censusController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/count', async (req, res) => {
    req.query.isCount = true;
    const data = await censusController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
