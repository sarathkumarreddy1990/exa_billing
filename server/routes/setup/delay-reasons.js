const Router = require('express-promise-router');
const router = new Router();

const delayReasonData = require('../../data/setup/delay-reasons');
const httpHandler = require('../../shared/http');

router.get('/count', async (req, res) => {
    const data = await delayReasonData.getListCount(req.query);

    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async (req, res) => {
    const data = await delayReasonData.getDelayReason({
        id: req.params.id,
        ...req.query
    });

    httpHandler.sendRows(req, res, data);
});

router.get('/', async (req, res) => {
    const data = await delayReasonData.getList(req.query);

    httpHandler.sendRows(req, res, data);
});

router.post('/', async (req, res) => {
    const data = await delayReasonData.saveDelayReason(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async (req, res) => {
    const data = await delayReasonData.updateDelayReason(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {

    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    };

    const data = await delayReasonData.delete(params);
    httpHandler.sendRows(req, res, data);

});

module.exports = router;
