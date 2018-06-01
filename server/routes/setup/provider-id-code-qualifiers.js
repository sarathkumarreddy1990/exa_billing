const Router = require('express-promise-router');
const router = new Router();

const providerIdCodeQualifierControllers = require('../../controllers/setup/provider-id-code-qualifiers');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await providerIdCodeQualifierControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await providerIdCodeQualifierControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await providerIdCodeQualifierControllers.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await providerIdCodeQualifierControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    const data = await providerIdCodeQualifierControllers.delete(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
