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

// const data =  eraController.getFileStorePath({ company_id: 1 });

const fileStorePath = 'D:/eraUploads';
const currentTime = new Date();

const dirPath = `${fileStorePath}/${currentTime.getFullYear()}/${currentTime.getMonth()}/${currentTime.getDate()}`;

if (fileStorePath) {
    mkdirp(dirPath);
}

const storage = multer.diskStorage({
    inMemory: true,
    destination: (req, file, callback) => {
        callback(null, dirPath);
    },
    filename: (req, file, callback) => {
        callback(null, file.originalname);
    }
});

let uploader = multer({ storage: storage }).single('displayImage');

router.post('/upload', uploader, async function (req, res) {
    if (req.file && req.file.path) {
        let filePath = req.file.path;
        const file_ext = req.file.originalname.slice(-3);

        await fs.readFile(filePath, async function (err, data) {
            let tempString = data.toString();
            let bufferString = tempString.replace(/(?:\r\n|\r|\n)/g, '');

            let fileMd5 = crypto.createHash('MD5').update(bufferString, 'utf8').digest('hex');

            const dataRes = await eraController.checkERAFileIsProcessed(fileMd5);

            if (dataRes.rows && dataRes.rows[0] && dataRes.rows[0].file_exists != false) {
                await fs.unlink(filePath, function (err) {
                    if (!err) {
                        return res.render('../server/views/era-file-upload.pug', {
                            companyID: 1,
                            duplicate_file: true,
                        });
                    }
                });
            }
            else {
                await fs.stat(filePath, async function (err, stats) {
                    let file_size = '';

                    if (stats) {
                        file_size = stats['size'];
                    }

                    req.file_store_id = '1';
                    req.company_id = '1';
                    req.status = 'pending';
                    req.file_type = '835';
                    req.file_path = filePath;
                    req.file_size = file_size;
                    req.file_md5 = fileMd5;
                    req.pathToUnlink = filePath;

                    const dataResponse = await eraController.saveERAFile(req);

                    if (dataResponse.rows && dataResponse.rows.length && dataResponse.rows[0].id) {
                        await fs.rename(filePath, dirPath + '/' + dataResponse.rows[0].id + '.' + file_ext, function (err) {
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
                });
            }
        });
    }
});

router.post('/process-file', async function (req, res) {
    const data = await eraController.processERAFile(req.body);
    httpHandler.send(req, res, data);
});

module.exports = router;
