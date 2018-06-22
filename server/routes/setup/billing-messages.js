const Router = require('express-promise-router');
const router = new Router();

const msgController = require('../../controllers/setup/billing-messages');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await msgController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await msgController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await msgController.createOrUpdate(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await msgController.createOrUpdate(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;