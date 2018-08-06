const Router = require('express-promise-router');
const router = new Router();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);

const claimsController = require('../../controllers/claim/index');
const httpHandler = require('../../shared/http');

router.get('/line_items', async function (req, res) {
    const data = await claimsController.getLineItemsDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/patient_insurances', async function (req, res) {
    const data = await claimsController.getPatientInsurances(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/service_facilities', async function (req, res) {
    let file_path = path.join(__dirname, '../../resx/site-info.json');
    let siteInfo = await readFileAsync(file_path, 'utf8');
    siteInfo = JSON.parse(siteInfo);
    const service_types = siteInfo.length ? siteInfo[0].service_types : {};
    httpHandler.send(req, res, service_types);
});


router.get('/service_facility', async function (req, res) {
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
    if (req.body.id) {
        const data = await claimsController.update(req.body);
        return httpHandler.send(req, res, data);
    }

    const data = await claimsController.save(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {

    const data = await claimsController.update(req.body);

    if (data && !data.rows) {
        return httpHandler.send(req, res, data);
    }

    httpHandler.sendRows(req, res, data);
});

router.post('/eligibility', async function (req, res) {
    const data = await claimsController.eligibility(req.body);
    httpHandler.send(req, res, data);
});

router.get('/studiesby_patient_id', async function (req, res) {
    const data = await claimsController.getStudiesByPatientId(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/getIcd9To10', async function (req, res) {
    const data = await claimsController.getIcd9To10(req.query);
    httpHandler.send(req, res, { 'result': data });
});

router.post('/icdcode', async function (req, res) {
    const data = await claimsController.saveICD(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/getApprovedReportsByPatient', async function (req, res) {
    const data = await claimsController.getApprovedReportsByPatient(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/remove_insurance_provider', async function (req, res) {
    const data = await claimsController.deleteProvider(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
