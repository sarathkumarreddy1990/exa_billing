const Router = require('express-promise-router');
const router = new Router();

const codesController = require('../../controllers/setup/billing-codes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await codesController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await codesController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await codesController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await codesController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {

    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    };

    const data = await codesController.delete(params);
    httpHandler.sendRows(req, res, data);
    
});


module.exports = router;
