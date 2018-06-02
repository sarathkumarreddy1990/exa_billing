const Router = require('express-promise-router');
const router = new Router();

const reasonController = require('../../controllers/setup/payment-reasons');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await reasonController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await reasonController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await reasonController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await reasonController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    const data = await reasonController.delete(req.params);
    httpHandler.sendRows(req, res, data);
});


module.exports = router;