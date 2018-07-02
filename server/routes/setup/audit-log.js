const Router = require('express-promise-router');
const router = new Router();

const auditLogController = require('../../controllers/setup/audit-log');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await auditLogController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await auditLogController.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
