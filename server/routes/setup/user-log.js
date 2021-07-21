const Router = require('express-promise-router');
const router = new Router();

const userLogController = require('../../controllers/setup/user-log');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await userLogController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await userLogController.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
