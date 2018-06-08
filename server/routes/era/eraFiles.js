const Router = require('express-promise-router');
const router = new Router();

const eraController = require('../../controllers/era/eraFiles');
const httpHandler = require('../../shared/http');
const multer = require('multer');

let dirPath = 'D:/eraInbox/';

httpHandler.initializeViews();

router.get('/', async function (req, res) {
    const data = await eraController.getEraFiles(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/iframeSrc', function (req, res) {
    return httpHandler.sendView('eob',
        {
            'companyID': 1,
            'isUploaded': false,
            'fileName': ''
        }, req, res);
});

const storage = multer.diskStorage({
    destination: ( req, file, callback ) => {
        callback(null, dirPath);
    },
    filename: ( req, file, callback ) => {
        callback(null, file.fieldname + '_' + Date.now() + '_' + file.originalname);
    }
});

const regERAExt = /edi|era|835|txt/i;

const uploader = multer({
    'fileFilter': ( req, file, callback ) => {
        const ext = file.originalname.slice(-3);

        if (!regERAExt.test(ext)) {
            req.body.invalidFormat = true;
            return callback(null, false);
        }

        req.body.filename = file.originalname;

        eraController.checkERA(req, result => {
            switch (result) {
            case true:
                req.body.isDuplicate = true;
                return callback(null, false);

            case false:
                req.body.fileExt = ext;
                return callback(null, true);

            default:
                return callback(result, false);
            }
        });
    },
    storage
}).single('displayImage');


router.post('/uploadFile', uploader, function (req, res) {
    if ( req.file && req.file.path ) {
        eraController.createERA(req, (error, result) => {
            httpHandler.sendView('eob', {
                'companyID': req.query.companyID,
                'isUploaded': true,
                'fileName': req.file.filename,
                'duplicate_file': !!req.body.isDuplicate,
                'valid_format': !!req.body.invalidFormat,
                result: result
            }, req, res);
        });
    }
    else {
        httpHandler.sendView('eob', {
            'companyID': req.query.companyID,
            'isUploaded': false,
            'fileName': '',
            'duplicate_file': !!req.body.isDuplicate,
            'valid_format': !!req.body.invalidFormat
        }, req, res);
    }
});

module.exports = router;
