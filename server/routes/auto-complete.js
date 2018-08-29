const Router = require('express-promise-router');
const router = new Router();

const autoCompleteController = require('../controllers/auto-complete');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await autoCompleteController.getCptAutoCompleteDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/providers', async function (req, res) {
    const data = await autoCompleteController.getProviders(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/icd_codes', async function (req, res) {
    const data = await autoCompleteController.getICDcodes(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/provider_group', async function (req, res) {
    const data = await autoCompleteController.getProviderGroups(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/insurances', async function (req, res) {
    const data = await autoCompleteController.getInsurances(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/patients', async function (req, res) {
    const data = await autoCompleteController.getPatients(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/orderingFacility', async function (req, res) {
    const data = await autoCompleteController.getOrderingFacility(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/getUsers', async function (req, res) {
    const data = await autoCompleteController.getUsers(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/getUserRoles', async function (req, res) {
    const data = await autoCompleteController.getUserRoles(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/insurance_payer_types', async function (req, res) {
    const data = await autoCompleteController.insurance_payer_types(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/edi_templates', async function (req, res) {
    const data = await autoCompleteController.getEDITemplateList();
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
