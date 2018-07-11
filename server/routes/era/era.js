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

router.get('/upload', function (req, res) {
    return res.render('../server/views/era-file-upload.pug', {
        staticAssetsRoot
    });
});

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage
});

router.post('/upload', upload.single('displayImage'), async function (req, res) {
    try {
        logger.info('Initiating ERA upload..');
        let response = await eraController.uploadFile(req);

        return res.render('../server/views/era-file-upload.pug', {
            fileNameUploaded: 0,
            duplicate_file: false,
            companyID: req.audit.companyId,
            previewFileName: '',
            status: '',
            staticAssetsRoot,
            ...response
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
    const data = await eraController.getProcessedEraFileDetails(req.query);
    httpHandler.send(req, res, data);
});

module.exports = router;
