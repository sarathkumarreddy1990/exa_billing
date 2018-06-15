const Router = require('express-promise-router');
const router = new Router();

const eraController = require('../../controllers/era/index');
const httpHandler = require('../../shared/http');
const multer = require('multer');
const mkdirp = require('mkdirp');
const fs = require('fs');
const crypto = require('crypto');

router.get('/list', async function (req, res) {
    const data = await eraController.getEraFiles(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/upload', function (req, res) {
    return res.render('../server/views/era-file-upload.pug',
        {
            'companyID': 1,
            'isUploaded': false,
            'fileName': ''
        });
});

const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage
});

router.post('/upload', upload.single('displayImage'), async function (req, res) {
    if (req.file) {

        const uploadEra = req.file;    
        const buffer = uploadEra.buffer;
        const fileSize = req.file.size;
    
        let tempString = buffer.toString();
        let bufferString = tempString.replace(/(?:\r\n|\r|\n)/g, '');

        let fileMd5 = crypto.createHash('MD5').update(bufferString, 'utf8').digest('hex');

        const dataRes = await eraController.checkERAFileIsProcessed(fileMd5, 1);

        const fileStorePath = dataRes.rows[0].file_store_info[0].root_directory;
        const fileExist = dataRes.rows[0].file_exists[0];

        const currentTime = new Date();

        const localPath = `${currentTime.getFullYear()}\\${currentTime.getMonth()}\\${currentTime.getDate()}`;
        const dirPath = `${fileStorePath}\\${localPath}`;

        if (fileStorePath) {
            if (!fs.exists(dirPath)) {
                mkdirp(dirPath);
            }
            else {
                throw 'Directory not found';
            }
        }
        else {
            throw 'Directory not found in file store';
        }

        if (fileExist != false) {
            return res.render('../server/views/era-file-upload.pug', {
                companyID: 1,
                duplicate_file: true,
            });
        }

        req.file_store_id = '1';
        req.company_id = '1';
        req.status = 'pending';
        req.file_type = '835';
        req.file_path = localPath;
        req.file_size = fileSize;
        req.file_md5 = fileMd5;

        const dataResponse = await eraController.saveERAFile(req);

        if (dataResponse.rows && dataResponse.rows.length && dataResponse.rows[0].id) {
            await fs.writeFile(dirPath + '/' + dataResponse.rows[0].id, bufferString, 'binary', function (err) {
                if (err) {
                    throw err;
                }

                return res.render('../server/views/era-file-upload.pug', {
                    'companyID': req.query.companyID,
                    'fileNameUploaded': dataResponse.rows[0].id,
                    'duplicate_file': false,
                    'valid_format': true
                });
            });
        }
    }
});

router.post('/process-file', async function (req, res) {
    const data = await eraController.processERAFile(req.body);
    httpHandler.send(req, res, data);
});

module.exports = router;
