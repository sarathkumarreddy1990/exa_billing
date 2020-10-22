const Router = require('express-promise-router');
const router = new Router();

const collectionsControllers = require('../../controllers/setup/collection-process');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await collectionsControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await collectionsControllers.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await collectionsControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    };

    const data = await collectionsControllers.delete(params);
    httpHandler.sendRows(req, res, data);

});

module.exports = router;
