const Router = require('express-promise-router');
const router = new Router();

const reasonController = require('../../controllers/setup/payment-reasons');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await reasonController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await reasonController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await reasonController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await reasonController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    let params = {
        ...req.params,
        ...req.audit
    };

    try {
        const data = await reasonController.delete(params);
        httpHandler.sendRows(req, res, data);
    } catch (error) {
        httpHandler.sendError(req, res, error, {
            errorCode: 100,
            errorDesc: 'Dependent data found'
        });
    }

});


module.exports = router;