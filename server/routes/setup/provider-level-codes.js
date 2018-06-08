const Router = require('express-promise-router');
const router = new Router();

const providerLevelCodeControllers = require('../../controllers/setup/provider-level-codes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await providerLevelCodeControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await providerLevelCodeControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await providerLevelCodeControllers.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await providerLevelCodeControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await providerLevelCodeControllers.delete(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    const data = await providerLevelCodeControllers.delete(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
