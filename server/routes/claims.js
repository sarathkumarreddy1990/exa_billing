const Router = require('express-promise-router');
const router = new Router();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

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

router.get('/service_facilities', async function (req, res) {
    let file_path = path.join(__dirname, '../resx/site-info.json');
    let siteInfo = await readFileAsync(file_path, 'utf8');
    siteInfo = JSON.parse(siteInfo);
    const service_types = siteInfo.length ? siteInfo[0].service_types : {};
    httpHandler.send(req, res, service_types);
});


router.get('/', async function (req, res) {
    const data = await claimsController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await claimsController.save(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await claimsController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/eligibility', async function (req, res) {
    const data = await claimsController.eligibility(req.body);
    httpHandler.send(req, res, data);
});

module.exports = router;