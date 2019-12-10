const Router = require('express-promise-router');
const router = new Router();

const autoBillingController = require('../../controllers/setup/auto-billing');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await autoBillingController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});
//
// router.get('/:id', async function (req, res) {
//     const data = await autoBillingController.getDataById(req.params);
//     httpHandler.sendRows(req, res, data);
// });
//
// router.post('/', async function (req, res) {
//     const data = await autoBillingController.create(req.body);
//     httpHandler.sendRows(req, res, data);
// });
//
// router.put('/:id', async function (req, res) {
//     const data = await autoBillingController.update(req.body);
//     httpHandler.sendRows(req, res, data);
// });

module.exports = router;
