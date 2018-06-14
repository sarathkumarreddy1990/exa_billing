const Router = require('express-promise-router');
const router = new Router();

const adjController = require('../../controllers/setup/adjustment-codes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await adjController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await adjController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await adjController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await adjController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    let params = { 
        ...req.params, 
        ...req.audit 
    };

    const data = await adjController.delete(params);
    httpHandler.sendRows(req, res, data);
});


module.exports = router;