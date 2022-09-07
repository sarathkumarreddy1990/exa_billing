const Router = require('express-promise-router');
const router = new Router();

const eraController = require('../../controllers/era/index');
const httpHandler = require('../../shared/http');
const logger = require('../../../logger');

const { staticAssetsRoot } = require('../../shared/constants');

const multer = require('multer');

router.get('/era_list', async function (req, res) {
    const data = await eraController.getEraFiles(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/era_file_preview', async function (req, res) {
    const data = await eraController.getDetailedEob(req.query);
    httpHandler.send(req, res, data);
});

router.get('/upload', async function (req, res) {
    let allowedExtensions = await eraController.getERAExtensions();

    return res.render('../server/views/era-file-upload.pug', {
        staticAssetsRoot,
        csrfToken: req.csrfToken(),
        billingRegionCode: req.session && req.session.billingRegionCode || '',
        allowedExtensions
    });
});

router.get('/get_json_file', async function (req, res) {
    const data = await eraController.getEraFileJson(req.query);
    httpHandler.send(req, res, data);
});

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage
});

router.post('/upload', upload.single('displayImage'), async function (req, res) {
    req.billingRegionCode = req.session && req.session.billingRegionCode || '';

    try {
        logger.info('Initiating ERA upload..');
        let response = await eraController.uploadFile(req);
        let allowedExtensions = await eraController.getERAExtensions();

        return res.render('../server/views/era-file-upload.pug', {
            fileNameUploaded: 0,
            duplicate_file: false,
            companyID: req.audit.companyId,
            previewFileName: '',
            status: '',
            staticAssetsRoot,
            ...response,
            csrfToken: req.csrfToken(),
            billingRegionCode: req.billingRegionCode || '',
            allowedExtensions
        });
    } catch (err) {
        httpHandler.sendError(req, res, err);
    }
});

router.post('/process-file', async function (req, res) {
    const data = await eraController.processERAFile(req.body);
    httpHandler.send(req, res, data);
});

router.get('/era_details', async function (req, res) {
    req.query.billingRegionCode = req.session && req.session.billingRegionCode || '';
    const data = await eraController.getProcessedEraFileDetails(req.query);
    httpHandler.send(req, res, data);
});

router.get('/eob_pdf', async function (req, res) {
    try {
        const data = await eraController.getEOBFile(req.query, res);
        httpHandler.sendPdf(req, res, data);
    } catch (err) {
        httpHandler.send(req, res, err.message);
    }
});

router.get('/eob_file_id', async function (req, res) {
    const data = await eraController.getEOBFileId(req.query.paymentID);
    httpHandler.send(req, res, data);
});

router.get('/download', async function (req, res) {
    const data = await eraController.initializeDownload(req.query);
    httpHandler.send(req, res, data);
});

module.exports = router;
