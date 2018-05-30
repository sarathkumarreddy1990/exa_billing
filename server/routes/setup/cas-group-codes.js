const Router = require('express-promise-router');
const router = new Router();

const casGroupCodeControllers = require('../../controllers/setup/cas-group-codes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await casGroupCodeControllers.getData();
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await casGroupCodeControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
