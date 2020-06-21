const Router = require('express-promise-router');
const router = new Router();

const subController = require('../../controllers/setup/submission-types');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await subController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await subController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await subController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await subController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    };

    const data = await subController.deleteData(params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
