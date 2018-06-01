const Router = require('express-promise-router');
const router = new Router();

const claimsController = require('../controllers/claims');
const httpHandler = require('../shared/http');

router.get('/get_line_items', async function (req, res) {
    const data = await claimsController.getLineItemsDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/get_patient_insurances', async function (req, res) {
    const data = await claimsController.getPatientInsurances(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/get_masterdetails', async function (req, res) {
    const data = await claimsController.getMasterDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await claimsController.save(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await claimsController.update(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;