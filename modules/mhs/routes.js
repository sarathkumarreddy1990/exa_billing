'use strict';

const Router = require('express-promise-router');
const router = new Router();
const mhs = require('./index');
const mhsController = require('../../server/controllers/mhs');
const httpHandler = require('../../server/shared/http');

router.use('/submitClaims', async (req, res) => {
    let response = await mhs.submitClaims(req.body);
    return httpHandler.send(req, res, response);
});

router.use('/downloadFile', async (req, res) => {
    const fileResponse = await mhsController.getFilePath(req.query);
    httpHandler.download(req, res, fileResponse);
});

router.post('/process-file', async function (req, res) {
    const data = await mhsController.processEraFile(req.body);
    httpHandler.send(req, res, data);
});

module.exports = router;

