const Router = require('express-promise-router');
const router = new Router();

const colorController = require('../../controllers/setup/status-color-codes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await colorController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await colorController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await colorController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await colorController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await colorController.delete(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;