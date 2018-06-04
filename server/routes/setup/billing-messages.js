const Router = require('express-promise-router');
const router = new Router();

const msgController = require('../../controllers/setup/billing-messages');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await msgController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await msgController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await msgController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;