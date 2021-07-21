const Router = require('express-promise-router');
const router = new Router();

const splitController = require('../../controllers/claim/split-claim');
const httpHandler = require('../../shared/http');

router.get('/', async (req, res) => {
    const data = await splitController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async (req, res) => {
    const data = await splitController.createClaim(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/validateData', async (req, res) => {
    const data = await splitController.getvalidatedData(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
