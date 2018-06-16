const Router = require('express-promise-router');
const router = new Router();

const x12MappingControllers = require('../../controllers/setup/insurance-x12-mapping');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await x12MappingControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await x12MappingControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await x12MappingControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
