'use strict';

const logger = require('../../logger');
const express = require('express');
const router = express.Router();
const multer = require('multer');

const ahs = require('./index');
const httpHandler = require('../../server/shared/http');


module.exports = function () {

    //TODO needs to be POST
    router.use('/submitClaims', async (req, res) => {
        let params = req.body;
        params.company_id = params.companyId;

        ahs.submitClaims(params, (submitErr, submitResponse) => {
            return httpHandler.send(req, res, submitErr || submitResponse);
        });

    });

    return router;
};
