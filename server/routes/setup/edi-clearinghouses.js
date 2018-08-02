const Router = require('express-promise-router');
const router = new Router();

const ediClearinghousesControllers = require('../../controllers/setup/edi-clearinghouses');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await ediClearinghousesControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await ediClearinghousesControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await ediClearinghousesControllers.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await ediClearinghousesControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    };

    const data = await ediClearinghousesControllers.delete(params);
    httpHandler.sendRows(req, res, data);

});

module.exports = router;
